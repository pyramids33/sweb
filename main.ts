
import * as path from "/deps/std/path/mod.ts";

import { serveSite } from "/site_app.ts";
import { AppState, Config } from "/site_appstate.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const testConfig:Config = {
    listenOptions: {
        port: 8098,
        hostname: '127.0.0.1'
    },
    cookieSecret: ['devsecret'],
    sitePath: './test',
    env: 'dev',
    staticPath: path.join(__dirname,'static')
};

const appState = new AppState(testConfig);
const siteDb = appState.openSiteDb();
const files = siteDb.files.listFiles();

console.log(files);

const abortController = new AbortController();
await serveSite(testConfig, abortController.signal);