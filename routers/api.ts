import * as path from "/deps/std/path/mod.ts";
import * as mime from "/deps/std/media_types/mod.ts";
import { Context, Router } from "/deps/oak/mod.ts";
import { bufferToHex, hexToBuffer } from "/deps/hextools/mod.ts";

import { AppState } from "/appstate.ts";
import * as coalesce from "/coalesce.ts";
import { FileRow } from "/database/filesdb.ts";
import { Next } from "/types.ts";


async function checkAuthKey (ctx:Context<AppState>, next:Next) {
    const siteDb = ctx.state.openSiteDb();
    const siteConfig = siteDb.config.all();
    const authKey = ctx.request.headers.get('x-authkey');

    if (authKey) {
        const authKeyHash = bufferToHex(await crypto.subtle.digest('SHA-256', hexToBuffer(authKey)));

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

    router.post('/.api/check', function (ctx:Context) {
        ctx.response.status = 200;
        return; 
    });

    router.post('/.api/setFile', async function (ctx:Context<AppState>) {
        const { sitePath } = ctx.state;
        const body = ctx.request.body({ type: 'form-data'});
        const form = await body.value.read({ outPath: sitePath.filesPath });
        
        const siteDb = ctx.state.openSiteDb();
        ctx.response.type = "json";
        
        const reqFile = form.files?.[0];

        if (reqFile === undefined || reqFile.name === undefined || reqFile.filename === undefined) {
            ctx.response.status = 400;
            ctx.response.body = { error: 'FILE_MISSING' };  
            return; 
        }

        if (coalesce.sha256HashHexString(form.fields.hash) === undefined) {
            ctx.response.status = 400;
            ctx.response.body = { error: 'INVALID_HASH', hash: form.fields.hash }; 
            return;
        }
        
        const currentFile = siteDb.files.fileByUrlPath(form.fields.urlPath);
        const fileSize = (await Deno.stat(reqFile.filename))?.size;
        
        siteDb.files.setFile({ 
            urlPath: form.fields.urlPath,
            hash: form.fields.hash,
            size: fileSize,
            mimeType: form.fields.mimeType||mime.contentType(path.extname(form.fields.urlPath)),
            storagePath: path.basename(reqFile.filename)
        });
    
        if (currentFile && !path.isAbsolute(currentFile.storagePath)) {
            Deno.remove(sitePath.filePath(currentFile.storagePath)).catch(()=>{});
        }

        ctx.response.status = 200;
        ctx.response.body = {};
    });

    router.post('/.api/deleteFile', async function (ctx:Context<AppState>) {
        const { sitePath } = ctx.state;
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();

        const deletedFile = siteDb.files.deleteFile(form.fields.urlPath);

        if (deletedFile && !path.isAbsolute(deletedFile.storagePath)) {
            Deno.remove(sitePath.filePath(deletedFile.storagePath)).catch(()=>{})
        }

        ctx.response.status = 200;
        ctx.response.body = {};
    });

    router.post('/.api/deleteList', async function (ctx:Context<AppState>) {
        const { sitePath } = ctx.state;
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();

        const deleteList = (form.fields.deleteList||'').split('\n');
        const deletedFiles:FileRow[] = [];

        siteDb.db.transaction(function () {
            for (const urlPath of deleteList) {
                const deletedFile = siteDb.files.deleteFile(urlPath);
                
                if (deletedFile && !path.isAbsolute(deletedFile.storagePath)){
                    deletedFiles.push(deletedFile);
                }
            }
        })(null);

        for (const deletedFile of deletedFiles) {
            Deno.remove(sitePath.filePath(deletedFile.storagePath)).catch(()=>{})
        }

        ctx.response.status = 200;
        ctx.response.body = {};
    });

    router.post('/.api/rename', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();

        siteDb.files.rename(form.fields.oldPath, form.fields.newPath);
        ctx.response.status = 200;
        ctx.response.body = {};
    });

    router.post('/.api/renameList', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: "form-data"});
        const form = await body.value.read();
        const siteDb = ctx.state.openSiteDb();
        const renameList = (form.fields.renameList||'').split('\n');

        siteDb.db.transaction(function () {
            for (let i = 0; i < renameList.length-1; i += 2) {
                siteDb.files.rename(renameList[i], renameList[i+1]);
            }
        })(null);

        ctx.response.status = 200;
        ctx.response.body = {};
    });

    router.post('/.api/listFiles', async function (ctx:Context<AppState>) {
        const body = ctx.request.body({ type: "form-data"});
        await body.value.read();

        const siteDb = ctx.state.openSiteDb();
        const list = siteDb.files.listFiles().map(x => { 
            return { urlPath: x.urlPath, hash: x.hash, size: x.size, mimeType: x.mimeType }
        });

        ctx.response.status = 200;
        ctx.response.body = list;
    });

    router.all('/.api/(.*)', function (ctx:Context<AppState>) {
        ctx.response.status = 404;
    })

    return router;
}