import * as path from "/deps/std/path/mod.ts";
import { Config } from "/server/types.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

export const testConfig:Config = {
    listenOptions: {
        port: 8098,
        hostname: '127.0.0.1'
    },
    workers: [],
    cookieSecret: ['devsecret'],
    sitePath: './test/site2',
    env: 'dev',
    staticPath: path.join(__dirname, '../server/', 'static'),
    domain: 'swebhost.localdev',
    mAPIEndpoints: [{
        name: 'dev',
        url: 'http://swebsite.localdev:3001/dev/tx',
        extraHeaders: { 'Content-Type': 'application/json' } 
    }]
};

export const urlPrefix = 'http://127.0.0.1:8098';
export const authKey = 'aabbccddee';
export const xPrv = 'xprv9s21ZrQH143K2cPPDuqeQ3CNmufwyPWU4uUv12cEDzzhnvfqztGjhk8KyLDNnCpK1rB5jPMR9zFiY94sfvHARxxyXSwFWLdLNLFTtRCTBKt';