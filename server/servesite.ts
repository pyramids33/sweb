import { Application } from "/deps/oak/mod.ts";

import { AppState } from "/server/appstate.ts";
import { getContentRouter } from "/server/routers/content.ts";
import { getApiRouter } from "/server/routers/api.ts";
import { getBip270Router } from "/server/routers/bip270.ts";

export interface serveSiteOptions {
    abortSignal?: AbortSignal
    onListen?: () => void
}

export function serveSite (appState:AppState, options:serveSiteOptions={}) {
    
    const config = appState.config;

    const app = new Application<AppState>({ 
        keys: config.cookieSecret, 
        contextState: "alias",
        state: appState
    });

    const apiRouter = getApiRouter();
    app.use(apiRouter.routes());
    
    const bip270Router = getBip270Router();
    app.use(bip270Router.routes());

    const contentRouter = getContentRouter();
    app.use(contentRouter.routes());

    if (options.onListen){
        app.addEventListener("listen", options.onListen);
    }

    const serverClosed = app.listen({ 
        hostname: config.listenOptions.hostname, 
        port: config.listenOptions.port,
        signal: options.abortSignal
    });

    return serverClosed;
}



