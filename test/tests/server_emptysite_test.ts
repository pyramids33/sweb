import { emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals } from "/deps/std/testing/asserts.ts";
import * as path from "/deps/std/path/mod.ts";

import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";
import { testConfig, urlPrefix } from "/test/testconfig.ts";
import { CookyFetch } from '/test/cookyfetch.ts';

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

// start sweb server 
const sitePath = path.join(testPath, 'site');
testConfig.sitePath = sitePath;

const abortController = new AbortController();
const appState = new AppState(testConfig);

try { 
    emptyDirSync(appState.sitePath.rootPath);
    await appState.sitePath.ensureDirs(); 
} catch { /** */ }

const serverClosed = serveSite(appState, { abortSignal: abortController.signal });
const cookyFetch = CookyFetch();

try {
    {
        const res = await fetch(urlPrefix+'/.status', { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, 'OK');
    }
    {  
        const res = await cookyFetch(urlPrefix+'/.hassession', { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, '0');
    }

    {   
        const res = await cookyFetch(urlPrefix+'/nonexistantfile.txt', { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body.includes('No Cookie'), true);
    }
    {
        const res = await cookyFetch(urlPrefix+'/nonexistantfile.txt', { signal: abortController.signal });
        assertEquals(res.status, 404);

        const body = await res.text();
        assertEquals(body, '404 - Page Not Found');
    }
    {
        const res = await cookyFetch(urlPrefix+'/nonexistantfile2.txt', { signal: abortController.signal });
        assertEquals(res.status, 404);

        const body = await res.text();
        assertEquals(body, '404 - Page Not Found');
    }
    {
        const siteDb = appState.openSiteDb();
        const files = siteDb.files.listFiles();
        assertEquals(files.length, 0);
    }
} catch (error) {
    throw error;
} finally {
    abortController.abort();
    await serverClosed;
    appState.closeDbs();
}
console.log(testName, 'passed');