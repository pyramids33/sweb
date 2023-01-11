import { emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals } from "/deps/std/testing/asserts.ts";
import * as path from "/deps/std/path/mod.ts";

import { sha256hex } from "/lib/hash.ts";
import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";
import { testConfig, urlPrefix, authKey } from "/test/testconfig.ts";
import { CookyFetch } from '/test/cookyfetch.ts';

import { ApiClient } from '/client/apiclient.ts';

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const sitePath = path.join(testPath, 'site');
testConfig.sitePath = sitePath;

const abortController = new AbortController();
const appState = new AppState(testConfig);

try { 
    emptyDirSync(appState.sitePath.rootPath);
    await appState.sitePath.ensureDirs(); 
} catch { /** */ }

const siteDb = appState.openSiteDb();
siteDb.meta.setValue('$.config.authKeyHash', sha256hex(authKey));

const serverClosed = serveSite(appState, { abortSignal: abortController.signal });
const cookyFetch = CookyFetch();
const apiClient = new ApiClient(urlPrefix, authKey, abortController.signal);

try {
    {
        const res = await fetch(urlPrefix+'/.status', { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, 'OK');
    }
    {   
        const res = await apiClient.status();
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, '');
    }

    const elephantJpgUrlPath = '/elephant.jpg';

    {
        const cwdRelativePath = path.join(__dirname, '../data/example', elephantJpgUrlPath);
        
        const res = await apiClient.files.upload(cwdRelativePath, elephantJpgUrlPath)
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, '{}');
    }
    {   
        const res = await cookyFetch(urlPrefix+elephantJpgUrlPath, { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body.includes('No Cookie'), true);
    }
    {
        const res = await cookyFetch(urlPrefix+elephantJpgUrlPath, { signal: abortController.signal });
        assertEquals(res.status, 200);

        const buf = (await res.arrayBuffer())

        //console.log(bufferToHex(buf.slice(-2)))

        if (buf) {
            assertEquals(buf.byteLength, 104046); 
            assertEquals(sha256hex(buf), 'ff831c52eddc18746f40fbfcb85aaf1e9bde04634d0062683ee1fc29935af49e');
        }
    }

} catch (error) {
    throw error;
} finally {
    abortController.abort();
    await serverClosed;
    appState.closeDbs();
}
console.log(testName, 'passed');