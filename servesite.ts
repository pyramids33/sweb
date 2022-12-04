import { Application } from "/deps/oak/mod.ts";

import { AppState, Config } from "/appstate.ts";
import { getContentRouter } from "/routers/content.ts";
import { getApiRouter } from "/routers/api.ts";
import { getBip270Router } from "./routers/bip270.ts";
import mstime from "/mstime.ts";

export function serveSite (appState:AppState, config: Config, abortSignal: AbortSignal) {

    const app = new Application<AppState>({ 
        keys: config.cookieSecret, 
        contextState: "alias",
        state: appState
    });

    const apiRouter = getApiRouter();
    app.use(apiRouter.routes());
    
    const bip270Router = getBip270Router(abortSignal);
    app.use(bip270Router.routes());

    const contentRouter = getContentRouter();
    app.use(contentRouter.routes());

    app.state.unCacheSessionDbs(abortSignal, mstime.mins(10)).catch(console.error);

    app.addEventListener("listen", () => console.log(`listening ${config.listenOptions.hostname}:${config.listenOptions.port}`))

    const serverClosed = app.listen({ 
        hostname: config.listenOptions.hostname, 
        port: config.listenOptions.port,
        signal: abortSignal
    });

    return serverClosed;
}



