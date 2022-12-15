import * as path from "/deps/std/path/mod.ts";
import * as mime from "/deps/std/media_types/mod.ts";
import { Context, Router } from "/deps/oak/mod.ts";
import { bufferToHex } from "/deps/hextools/mod.ts";

import { AppState } from "/appstate.ts";
import * as coalesce from "/coalesce.ts";
import { FileRow } from "/database/filesdb.ts";
import { Next } from "/types.ts";
import { PaywallFile } from "/paywallfile.ts";
import { getAuthKeyHash } from "/authkeyhash.ts";


async function checkAuthKey (ctx:Context<AppState>, next:Next) {
    const siteDb = ctx.state.openSiteDb();
    const siteConfig = siteDb.config.get('authKeyHash');
    const authKey = ctx.request.headers.get('x-authkey');

    if (authKey) {
        const authKeyHash = await getAuthKeyHash(authKey);

        if (authKeyHash === siteConfig.authKeyHash) {
            await next();
            return;
        }
    }

    ctx.response.status = 403;
    ctx.response.type = "json";
    ctx.response.body = { error: 'FORBIDDEN' };
    return;
}



export function getApiRouter () : Router<AppState> {

    const router = new Router<AppState>();

    router.use(checkAuthKey);

    router.post('/.api/status', function (ctx:Context) {
        ctx.response.status = 200;
        return; 
    });
    
    router.post('/.api/files/info', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();
        const info = siteDb.files.dirInfo(form.fields.urlPath);

        delete info.storagePath;
        for (const item of info.files) {
            delete item.storagePath;
        }

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = info;
    });

    router.post('/.api/files/download', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();
        const fileRow = siteDb.files.fileRow(form.fields.urlPath);

        if (fileRow === undefined) {
            ctx.response.status = 404;
            return;
        }

        ctx.response.headers.set('content-type', fileRow.mimeType);
        ctx.response.headers.set('content-disposition', 'filename=' + path.basename(fileRow.urlPath));

        if (path.isAbsolute(fileRow.storagePath)) {
            await ctx.send({ root: path.dirname(fileRow.storagePath), path: path.basename(fileRow.storagePath),  });
        } else {
            await ctx.send({ root: ctx.state.sitePath.filesPath, path: fileRow.storagePath });
        } 
    });

    router.post('/.api/files/upload', async function (ctx:Context<AppState>) {
        const sitePath = ctx.state.sitePath;
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

        const size = (await Deno.stat(reqFile.filename))?.size;
        const mimeType = form.fields.mimeType || mime.contentType(path.extname(form.fields.urlPath)) || 'application/octet-stream';
        const hash = form.fields.hash;
        const urlPath = form.fields.urlPath;
        const storagePath = path.basename(reqFile.filename);

        const siteDb = ctx.state.openSiteDb();
        const currentFile = siteDb.files.fileRow(form.fields.urlPath);
        siteDb.files.upsertFile({ urlPath, hash, size, mimeType, storagePath });
    
        if (currentFile && !path.isAbsolute(currentFile.storagePath)) {
            Deno.remove(sitePath.filePath(currentFile.storagePath)).catch(() => {});
        }

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    router.post('/.api/files/delete', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();

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
            Deno.remove(ctx.state.sitePath.filePath(deletedFile.storagePath)).catch(()=>{})
        }

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    router.post('/.api/files/rename', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();
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

    router.post('/.api/files/list', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();

        const offset = coalesce.safeInt(form.fields.offset, 0, 10);

        const siteDb = ctx.state.openSiteDb();
        const list = siteDb.files.listFiles(form.fields.search, 1000, offset);

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = list.map(x => { 
            return { urlPath: x.urlPath, hash: x.hash, size: x.size, mimeType: x.mimeType }
        });
    });

    router.post('/.api/paywalls/set', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read();
        
        const pwf = PaywallFile.fromJSON(form.fields.paywalls);
        const pwfJson = pwf.toJSON();
        const pwfHash = bufferToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwfJson)));
    
        const siteDb = ctx.state.openSiteDb();
        siteDb.config.set({ paywalls: pwfJson });
        siteDb.config.set({ paywallFileHash: pwfHash });

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    router.post('/.api/paywalls/get', async function (ctx:Context<AppState>) {
        await ctx.request.body({ type: 'form-data'}).value.read();
        const siteDb = ctx.state.openSiteDb();
        
        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = JSON.parse(siteDb.config.getOne('paywalls')||'{}');
    });

    router.post('/.api/invoices/transfer', async function (ctx:Context) {
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();

        /* client sends the invoice refs to be deleted */
        siteDb.deleteByRefList((form.fields.delete||'').split(','));

        ctx.response.type = "json";
        ctx.response.status = 200;

        if (form.fields.doSend === '1') {
            /* the next 1000 are sent */
            ctx.response.body = siteDb.getNext1000Invoices();
        } else {
            ctx.response.body = [];
        }
    });

    router.all('/.api/(.*)', function (ctx:Context<AppState>) {
        ctx.response.status = 404;
    })

    return router;
}