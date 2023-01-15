import * as path from "/deps/std/path/mod.ts";
import * as mime from "/deps/std/media_types/mod.ts";
import { concat } from "/deps/std/bytes/concat.ts";
import { bufferToHex, hexToBuffer } from "/deps/hextools/mod.ts";
import { Context, Router } from "/deps/oak/mod.ts";

import * as coalesce from "/lib/coalesce.ts";
import { sha256hex } from "/lib/hash.ts";

import { RequestState } from "/server/appstate.ts";
import { FileRow } from "/server/database/filesdb.ts";
import { Next } from "/server/types.ts";
import mstime from "../../lib/mstime.ts";






async function checkAuthKey (ctx:Context<RequestState>, next:Next) {
    const app = ctx.state.app!;
    const siteDb = app.openSiteDb();
    const siteAuthKeyHash = siteDb.meta.getValue('$.config.authKeyHash');
    const userAuthKey = ctx.request.headers.get('x-authkey');

    if (userAuthKey) {
        const userAuthKeyHash = sha256hex(new Uint8Array(hexToBuffer(userAuthKey)));

        if (userAuthKeyHash === siteAuthKeyHash) {
            await next();
            return;
        }
    }

    ctx.response.status = 403;
    ctx.response.type = "json";
    ctx.response.body = { error: 'FORBIDDEN' };
    return;
}



export function getApiRouter () : Router<RequestState> {

    const router = new Router<RequestState>();

    // no authKey check
    router.post('/.api/dnsauth', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const body = ctx.request.body({ type: 'form-data'});
        await body.value.read();

        const siteDb = app.openSiteDb();
        const lastAttempt = siteDb.meta.getValue('$.config.dnsAuthDate') as number;
        
        if (lastAttempt > mstime.minsAgo(1)) {
            ctx.response.status = 403;
            ctx.response.type = "json";
            ctx.response.body = { error: 'FORBIDDEN' };
            return;
        }

        siteDb.meta.setValue('$.config.dnsAuthDate', Date.now())

        const authKey = coalesce.sha256HashHexString(ctx.request.headers.get('x-authkey'));

        if (authKey === undefined) {
            ctx.response.status = 403;
            ctx.response.type = "json";
            ctx.response.body = { error: 'FORBIDDEN' };
            return;
        }

        let valid;
        
        if (app.config.env === 'dev') {
            valid = true;
        } else {
            // url object will parse valid domain
            const v = new URL('http://example.org');
            v.hostname = app.config.domain;
            const domain = v.hostname;

            const txtRecords = await Deno.resolveDns(domain, 'TXT');
            const dnsAuthKey = sha256hex(concat(new TextEncoder().encode('swebdns'), new Uint8Array(hexToBuffer(authKey))));
            valid = txtRecords.flat().find(x => x === dnsAuthKey) !== undefined;
        }

        if (!valid) {
            ctx.response.status = 403;
            ctx.response.type = "json";
            ctx.response.body = { error: 'FORBIDDEN' };
            return;
        } 

        siteDb.meta.setValue('$.config.authKeyHash', sha256hex(new Uint8Array(hexToBuffer(authKey))));

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
        return;
    });


    router.use(checkAuthKey);

    router.post('/.api/status', function (ctx:Context) {
        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
        return; 
    });
    
    router.post('/.api/files/info', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read();
        const siteDb = app.openSiteDb();
        const info = siteDb.files.dirInfo(form.fields.urlPath);

        delete info.storagePath;
        for (const item of info.files) {
            delete item.storagePath;
        }

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = info;
    });

    router.post('/.api/files/download', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read();
        const siteDb = app.openSiteDb();
        const fileRow = siteDb.files.fileRow(form.fields.urlPath);

        if (fileRow === undefined) {
            ctx.response.status = 404;
            return;
        }

        ctx.response.headers.set('content-type', fileRow.mimeType);
        ctx.response.headers.set('content-disposition', 'filename=' + path.basename(fileRow.urlPath));

        if (path.isAbsolute(fileRow.storagePath)) {
            await ctx.send({ root: path.dirname(fileRow.storagePath), path: path.basename(fileRow.storagePath)  });
        } else {
            await ctx.send({ root: app.sitePath.filesPath, path: fileRow.storagePath });
        } 
    });

    router.post('/.api/files/upload', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const sitePath = app.sitePath;
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read({ outPath: sitePath.filesPath });
    
        const reqFile = form.files?.[0];

        if (reqFile === undefined || reqFile.name === undefined || reqFile.filename === undefined) {
            ctx.response.status = 400;
            ctx.response.type = "json";
            ctx.response.body = { error: 'FILE_MISSING' };  
            return; 
        }

        if (coalesce.sha256HashHexString(form.fields.hash) === undefined) {
            ctx.response.status = 400;
            ctx.response.type = "json";
            ctx.response.body = { error: 'INVALID_HASH', hash: form.fields.hash }; 
            return;
        }

        const size = (await Deno.stat(reqFile.filename))?.size-2;
        // hack : https://github.com/oakserver/oak/issues/581
        Deno.truncateSync(reqFile.filename, size);

        const mimeType = form.fields.mimeType || mime.contentType(path.extname(form.fields.urlPath)) || 'application/octet-stream';
        const hash = form.fields.hash;
        const urlPath = form.fields.urlPath;
        const storagePath = path.basename(reqFile.filename);

        const siteDb = app.openSiteDb();
        const currentFile = siteDb.files.fileRow(form.fields.urlPath);

        siteDb.files.upsertFile({ urlPath, hash, size, mimeType, storagePath });
    
        if (currentFile && !path.isAbsolute(currentFile.storagePath)) {
            Deno.remove(sitePath.filePath(currentFile.storagePath)).catch(() => {});
        }

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    router.post('/.api/files/delete', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = app.openSiteDb();

        const deleteList = (form.fields.delete||'').split('\n');
        const deletedFiles:FileRow[] = [];

        siteDb.db.transaction(function () {
            for (const urlPath of deleteList) {
                const deletedFile = siteDb.files.deleteFile(urlPath);
                
                if (deletedFile && !path.isAbsolute(deletedFile.storagePath)) {
                    deletedFiles.push(deletedFile);
                }
            }
        })(null);

        for (const deletedFile of deletedFiles) {
            Deno.remove(app.sitePath.filePath(deletedFile.storagePath)).catch(()=>{})
        }

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    router.post('/.api/files/rename', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = app.openSiteDb();
        const renameList = (form.fields.rename||'').split('\n');

        siteDb.db.transaction(function () {
            for (let i = 0; i < renameList.length-1; i += 2) {
                siteDb.files.rename(renameList[i], renameList[i+1]);
                
            }
        })(null);

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    router.post('/.api/files/list', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();

        const offset = coalesce.safeInt(form.fields.offset, 0, 10);

        const siteDb = app.openSiteDb();
        const list = siteDb.files.listFiles(form.fields.search, 1000, offset);

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = list.map(x => { 
            return { urlPath: x.urlPath, hash: x.hash, size: x.size, mimeType: x.mimeType }
        });
    });

    router.post('/.api/invoices/transfer', async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read();
        const siteDb = app.openSiteDb();

        /* client sends the invoice refs to be deleted */
        const deleteList = (form.fields.delete||'').split('\n');
        
        if (deleteList.length > 0) {
            siteDb.invoices.deleteByRefList(deleteList);
        }

        const lastRef = deleteList.reduce((p,c) => c > p ? c : p, '');

        ctx.response.type = "json";
        ctx.response.status = 200;

        if (form.fields.doSend === '1') {
            /* the next 1000 are sent */
            ctx.response.body = siteDb.invoices.getNext1000Invoices(lastRef).map(x => { 
                return { ...x, txbuf: (x.txbuf ? bufferToHex(x.txbuf) : undefined) }
            });
        } else {
            ctx.response.body = [];
        }
    });

    router.all('/.api/(.*)', function (ctx:Context<RequestState>) {
        ctx.response.status = 404;
    })

    return router;
}