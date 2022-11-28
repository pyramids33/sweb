import * as path from "/deps/std/path/mod.ts";
import { Context, Router } from "/deps/oak/mod.ts";

import { readWriteSession, hasSession, checkSession } from "/session.ts";
import { AppState, Config } from "/site_appstate.ts";

export function getSiteRouter (config: Config) : Router<AppState> {

    const router = new Router<AppState>();

    router.post('/(.*)', async function (ctx:Context) {
        const body = ctx.request.body({ type: 'form-data'});
        const data = await body.value.read({ outPath: config.sitePath });
        
        if (data.files !== undefined && data.files[0] && data.files[0].filename) {
            const destPath = path.join(config.sitePath, ctx.request.url.pathname);
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

    router.use(readWriteSession);

    router.get('/.hascookie', hasSession);

    router.get('/(.*)', checkSession, async function (ctx:Context) {
        try {
            await ctx.send({ root: config.sitePath, path: ctx.request.url.pathname });
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

    return router;
}