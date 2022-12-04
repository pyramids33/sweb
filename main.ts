
import * as path from "/deps/std/path/mod.ts";

import { serveSite } from "/servesite.ts";
import { AppState, Config } from "/appstate.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const testConfig:Config = {
    listenOptions: {
        port: 8098,
        hostname: '127.0.0.1'
    },
    cookieSecret: ['devsecret'],
    sitePath: './test/site2',
    env: 'dev',
    staticPath: path.join(__dirname,'static'),
    domain: 'swebhost.localdev',
    mAPIEndpoints: [{
        name: 'dev',
        url: 'http://swebsite.localdev:3001/dev/tx',
        extraHeaders: { 'Content-Type': 'application/json' } 
    }]
};

function onSignal () {
    abortController.abort();
}

Deno.addSignalListener("SIGTERM", onSignal);
Deno.addSignalListener("SIGINT", onSignal);
Deno.addSignalListener("SIGHUP", onSignal);

const abortController = new AbortController();
const appState = new AppState(testConfig);
await serveSite(appState, testConfig, abortController.signal);
appState.close();
console.log('server closed.');