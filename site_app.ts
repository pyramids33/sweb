import { Application } from "/deps/oak/mod.ts";
import { AppState, Config } from "/site_appstate.ts";
import { getSiteRouter } from "/site_router.ts";

import mstime from "/mstime.ts";

export function serveSite (config: Config, abortSignal: AbortSignal) {

    const app = new Application<AppState>({ 
        keys: config.cookieSecret, 
        contextState: "alias",
        state: new AppState(config)
    });
    
    const router = getSiteRouter(config);

    app.use(router.routes());
    
    app.state.unCacheSessionDbs(abortSignal, mstime.mins(10)).catch(console.error);

    const serverClosed = app.listen({ 
        hostname: config.listenOptions.hostname, 
        port: config.listenOptions.port,
        signal: abortSignal
    });

    return serverClosed;
}



