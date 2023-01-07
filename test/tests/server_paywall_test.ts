import { emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals, assertStringIncludes } from "/deps/std/testing/asserts.ts";
import * as path from "/deps/std/path/mod.ts";

import { sha256hex } from "/lib/hash.ts";
import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";
import { testConfig, urlPrefix, authKey } from "/test/testconfig.ts";

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
const apiClient = new ApiClient(urlPrefix, authKey, abortController.signal);

try {

    // upload necessary files
    {
        const cwdRelativePath = path.join(__dirname, '../data/example', '/elephant.jpg');

        const res = await apiClient.files.upload(cwdRelativePath, '/elephant.jpg')
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, '{}');
    }
    {
        const cwdRelativePath = path.join(__dirname, '../data/paywalls.json');
        
        const res = await apiClient.files.upload(cwdRelativePath, '/paywalls.json')
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, '{}');
    }
    {
        const cwdRelativePath = path.join(__dirname, '../data/xpub.txt');
        
        const res = await apiClient.files.upload(cwdRelativePath, '/xpub.txt')
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body, '{}');
    }

    // get cookie
    {   
        const res = await fetch(urlPrefix+'/elephant.jpg', { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertStringIncludes(body,'No Cookie');
    }

    // see paywall
    {
        const res = await fetch(urlPrefix+'/elephant.jpg', { signal: abortController.signal });
        assertEquals(res.status, 402);

        const body = await res.text();
        assertStringIncludes(body, '402 Payment Required');
    }

    // create invoice details
    let invoice;
    {
        const res = await fetch(urlPrefix+'/.bip270/inv', { 
            signal: abortController.signal, 
            method: 'POST',
            headers:{ 'Content-Type': 'application/x-www-form-urlencoded' },    
            body: new URLSearchParams({ urlPath: '/elephant.jpg' })
        });
        assertEquals(res.status, 200);

        const body = await res.json();
        assertEquals(body.ref !== undefined, true);
        invoice = body;
    }

    // get invoice info
    let dataUrl = new URLSearchParams(invoice.dataURL.slice(9)).get('r');
    dataUrl = urlPrefix + '/' + dataUrl?.slice(dataUrl.indexOf('.bip'));
    {
        const res = await fetch(dataUrl, { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.json();
        assertEquals(body.outputs, [{"script":"76a914fbdd12051d9b27be6aa3707fd628060d3c70f28d88ac","amount":100}]);
    }

    // pay invoice
    {
        const res = await fetch(urlPrefix+'/.bip270/inv/devpay?ref='+invoice.ref, { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertStringIncludes(body, '');
    }

    // access granted
    {
        const res = await fetch(urlPrefix+'/elephant.jpg', { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.blob();
        assertEquals(body.size, 104046);
    }

} catch (error) {
    throw error;
} finally {
    abortController.abort();
    await serverClosed;
    appState.close();
}
console.log(testName, 'passed');