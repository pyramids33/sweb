import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";
import { Config } from "/server/types.ts";

import mstime from "/lib/mstime.ts";

const abortController = new AbortController();
let workerId:number;
let appState:AppState;

function close () {
    try {
        appState?.closeDbs();
        self.postMessage({ message: 'closed' });
    } catch { /** */ }
}


async function onMessage (event:MessageEvent) { 
    
    if (event.data.message === 'init') {
        const config:Config = event.data.config;
        workerId = event.data.workerId;

        appState = new AppState(config);
        appState.workerId = workerId;
        appState.runSessionDbUncacher(abortController.signal, mstime.mins(10)).catch(console.error);
        appState.runPaywallFileReloader(mstime.secs(30));
        appState.runXPubReloader(mstime.secs(30));
        serveSite(appState, {
            abortSignal: abortController.signal,
            onListen: () => {
                console.log(`listening ${config.listenOptions.hostname}:${config.listenOptions.port}`)
            }
        }).then(close);
        console.log('worker', workerId, 'started');
    }

    if (event.data.message === 'payment') {
        await appState.sse.onPayment(event.data.target);
    }

    if (event.data.message === 'close') {
        self.postMessage({ message: 'closing' });
        abortController.abort();
        await appState.sse.close();
    }
}

// message from main.ts
self.addEventListener('message', onMessage);
self.postMessage({ message: 'ready' });


// self.addEventListener("error", () => {
//     console.log("self.onerror in worker");
// });

// self.addEventListener("unhandledrejection", () => {
//     console.log("self.onunhandledrejection in worker");
// });