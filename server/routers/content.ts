import * as path from "/deps/std/path/mod.ts";
import * as mime from "/deps/std/media_types/mod.ts";

import { Context, Router } from "/deps/oak/mod.ts";

import { readWriteSessionHeaders, hasSession, checkSession } from "/server/middleware/session.ts";
import { AppState } from "/server/appstate.ts";
import mstime from "/lib/mstime.ts";

export function getContentRouter () : Router<AppState> {

    const router = new Router<AppState>();

    router.get('/.status', function (ctx:Context) {
        ctx.response.body = 'OK';
        ctx.response.status = 200;
        return;
    });

    router.use(readWriteSessionHeaders);

    router.get('/.hassession', hasSession);

    router.get('/(.*)', checkSession, async function (ctx:Context<AppState>) {
        const { sitePath, config } = ctx.state;
        const siteDb = ctx.state.openSiteDb();

        if (['/paywalls.json','/xpub.txt'].includes(ctx.request.url.pathname)) {
            ctx.response.status = 404;
            ctx.response.body = '404 - Page Not Found';
            return;
        }

        let fileRow = siteDb.files.fileRow(ctx.request.url.pathname);

        if (fileRow === undefined) {
            fileRow = siteDb.files.fileRow(ctx.request.url.pathname + '/');
            if (fileRow) {
                ctx.response.redirect(ctx.request.url.pathname + '/');
                return;
            } else {
                ctx.response.status = 404;
                ctx.response.body = '404 - Page Not Found';
                return;
            }
        }

        const paywallFile = await ctx.state.getPaywallFile();
        const matchResult = paywallFile.matchUrl(ctx.request.url.pathname);

        if (matchResult) {
            const sessionDb = ctx.state.openSessionDb(ctx.state.session.sessionId!);
            const hasAccess = sessionDb.accessCheck(matchResult.match, mstime.hoursAgo(6));

            if (!hasAccess) {
                ctx.response.status = 402;
                ctx.response.headers.set('content-disposition', 'inline; filename=402.html');
                await ctx.send({ root: config.staticPath, path: '402.html' });
                return;
            }
        }

        const mimeType = fileRow.mimeType || mime.contentType(path.extname(fileRow.urlPath));
    
        if (mimeType) {
            ctx.response.headers.set('content-type', mimeType);
        }

        ctx.response.headers.set('content-disposition', 'inline; filename=' + path.basename(fileRow.urlPath));

        if (path.isAbsolute(fileRow.storagePath)) {
            await ctx.send({ root: path.dirname(fileRow.storagePath), path: path.basename(fileRow.storagePath),  });
        } else {
            await ctx.send({ root: sitePath.filesPath, path: fileRow.storagePath });
        } 
    });

    return router;
}