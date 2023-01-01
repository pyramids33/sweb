import { assertEquals } from "/deps/std/testing/asserts.ts";
import * as path from "/deps/std/path/mod.ts";
import tough from "npm:tough-cookie";
const { Cookie, CookieJar } = tough;

import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";
import { testConfig } from "/test/testconfig.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

testConfig.sitePath = path.join(__dirname, './empty_site');

const abortController = new AbortController();
const appState = new AppState(testConfig);

try { await Deno.remove(appState.sitePath.siteDbPath); } catch { /** */ }
try { await Deno.remove(appState.sitePath.siteDbPath+'-shm'); } catch { /** */ }
try { await Deno.remove(appState.sitePath.siteDbPath+'-wal'); } catch { /** */ }

const serverClosed = serveSite(appState, abortController.signal);
const cookiejar = new CookieJar();

const urlPrefix = 'http://127.0.0.1:8098';

try {
    {
        const res = await fetch(urlPrefix+'/.status', { signal: abortController.signal, keepalive: false });
        const body = await res.text();
        assertEquals(res.status, 200);
        assertEquals(body, 'OK');
    }
    {  
        const res = await fetch(urlPrefix+'/.hassession', { signal: abortController.signal });
        const body = await res.text();
        assertEquals(res.status, 200);
        assertEquals(body, '0');
    }

    const nonExistantFileUrl = '/nonexistantfile.txt';
    {   
        const res = await fetch(urlPrefix+nonExistantFileUrl, { signal: abortController.signal });
        const body = await res.text();

        for (const [k,v] of res.headers.entries()) {
            if (k.toLowerCase() === 'set-cookie') {
                cookiejar.setCookieSync(Cookie.parse(v), nonExistantFileUrl);
            }
        }

        assertEquals(res.status, 200);
        assertEquals(body.includes('No Cookie'), true);
    }
    {
        const cookieString = cookiejar.getCookieStringSync(nonExistantFileUrl);
        const res = await fetch(nonExistantFileUrl, { headers: { "Cookie": cookieString },  signal: abortController.signal });
        const body = await res.text();

        assertEquals(res.status, 404);
        assertEquals(body, '');
    }
    {
        const siteDb = appState.openSiteDb();
        const files = siteDb.files.listFiles();
        console.log(files);  
        assertEquals(files.length, 0);
    }
} catch (error) {
    throw error;
} finally {
    abortController.abort();
    await serverClosed;
    appState.close();
}
