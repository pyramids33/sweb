import { assertEquals } from "/deps/std/testing/asserts.ts";
import * as path from "/deps/std/path/mod.ts";
import tough from "npm:tough-cookie";
const { Cookie, CookieJar } = tough;

import { SitePath } from "/site_path.ts";
import { serveSite } from "/site_app.ts";
import { AppState, Config } from "/site_appstate.ts";

import { openDb } from "/database/mod.ts";
import SiteDbModule from "/database/sitedb.ts";
import type { SiteDbApi } from "/database/sitedb.ts";

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

try { await Deno.remove('./test/site.db'); } catch (err) { err; }
const siteDb = openDb<SiteDbApi>(SiteDbModule, './test/site.db');
siteDb.db.close();

Deno.test('empty server', async function (_t:Deno.TestContext) {

    const abortController = new AbortController();
    const serverClosed = serveSite(testConfig, abortController.signal);
    const cookiejar = new CookieJar();

    try {

        {
            const res = await fetch('http://127.0.0.1:8098/.status', { signal: abortController.signal, keepalive: false });
            const body = await res.text();
            assertEquals(res.status, 200, '/.status returns 200');
            assertEquals(body, 'OK', '/.status returns OK');
        }
        
        {  
            const res = await fetch('http://127.0.0.1:8098/.hascookie', { signal: abortController.signal });
            const body = await res.text();
            assertEquals(res.status, 200, '/.hascookie status === 200');
            assertEquals(body, '0', '/.hascookie body === 0');
        }

        const nonExistantFileUrl = 'http://127.0.0.1:8098/nonexistantfile.txt';

        {   
            const res = await fetch(nonExistantFileUrl, { signal: abortController.signal });
            const body = await res.text();

            for (const [k,v] of res.headers.entries()) {
                if (k.toLowerCase() === 'set-cookie') {
                    cookiejar.setCookieSync(Cookie.parse(v), nonExistantFileUrl);
                }
            }

            assertEquals(res.status, 200, 'status === 200');
            assertEquals(body.includes('No Cookie'), true, 'no cookie page');
        }

        {
            const cookieString = cookiejar.getCookieStringSync(nonExistantFileUrl);
            const res = await fetch(nonExistantFileUrl, { 
                headers: { "Cookie": cookieString },  
                signal: abortController.signal 
            });
            const body = await res.text();

            assertEquals(res.status, 404, 'status === 404');
            assertEquals(body, '', 'no body');
        }

        {
            const sitePath = new SitePath(testConfig.sitePath);
            await Deno.remove(sitePath.siteDbPath);
            const appState = new AppState(testConfig);
            const siteDb = appState.openSiteDb();

            const files = siteDb.files.listFiles();
            console.log(files);  
            assertEquals(files.length, 0, 'no files');
        }
    } catch (error) {
        throw error;
    } finally {
        abortController.abort();
        await serverClosed;
    }
});