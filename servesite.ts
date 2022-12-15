import { Application } from "/deps/oak/mod.ts";

import { AppState } from "/appstate.ts";
import { getContentRouter } from "/routers/content.ts";
import { getApiRouter } from "/routers/api.ts";
import { getBip270Router } from "/routers/bip270.ts";
import mstime from "/mstime.ts";

export function serveSite (appState:AppState, abortSignal: AbortSignal) {
    
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

    app.state.runSessionDbUncacher(abortSignal, mstime.mins(10)).catch(console.error);
    app.state.runPaywallFileReloader(mstime.secs(30));

    app.addEventListener("listen", () => console.log(`listening ${config.listenOptions.hostname}:${config.listenOptions.port}`))

    const serverClosed = app.listen({ 
        hostname: config.listenOptions.hostname, 
        port: config.listenOptions.port,
        signal: abortSignal
    });

    return serverClosed;
}



