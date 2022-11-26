import * as path from "/deps/std/path/mod.ts";
import { Application, Context, Router } from "/deps/oak/mod.ts";

import { readWriteCookie, hasCookie, checkCookie } from "/cookie.ts";
import { AppState, Config } from "/types.ts";

export function serveSite (config: Config, abortSignal: AbortSignal) {

    const app = new Application<AppState>({ keys: config.cookieSecret });

    const router = new Router<AppState>();

    router.post('/(.*)', async function (ctx:Context) {
        const body = ctx.request.body({ type: 'form-data'});
        const data = await body.value.read({ outPath: config.siteDir });
        
        if (data.files !== undefined && data.files[0] && data.files[0].filename) {
            const destPath = path.join(config.siteDir, ctx.request.url.pathname);
            await Deno.mkdir(destPath, { recursive: true });
            await Deno.rename(data.files[0].filename, destPath);
        }

        return;
    });

    router.get('/.status', function (ctx:Context) {
        ctx.response.body = 'OK';
        ctx.response.status = 200;
        return;
    });

    router.use(readWriteCookie);

    router.get('/.hascookie', hasCookie);

    router.get('/(.*)', checkCookie, async function (ctx:Context) {
        try {
            await ctx.send({ root: config.siteDir, path: ctx.request.url.pathname });
        } catch (error) {
            if (error.message.startsWith('No such file or directory')) {
                ctx.response.body = '';
                ctx.response.status = 404;
                return;
            } else {
                throw error;
            }
        }
    });

    app.use(router.routes());
    
    const serverClosed = app.listen({ 
        hostname: config.listenOptions.hostname, 
        port: config.listenOptions.port,
        signal: abortSignal
    });

    return serverClosed;
}



