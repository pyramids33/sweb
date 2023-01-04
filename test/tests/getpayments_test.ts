import { copySync, emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals, assertStringIncludes } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import { sha256hex } from "/lib/hash.ts";
import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";

import { testConfig, urlPrefix, authKey, xPrv } from "/test/testconfig.ts";

import { CommandRunner } from '../commandrunner.ts';
import { ApiClient } from "/client/apiclient.ts";
import ClientSiteDbModule from "/client/clientsitedb.ts";
import {CookyFetch} from "../cookyfetch.ts";
import { openDb } from "../../lib/database/mod.ts";

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const sitePathLocal = path.join(testPath, 'example');
emptyDirSync(sitePathLocal);

const execPath = path.join(__dirname, '../swebcli');

const sitePathServer = path.join(testPath, 'site');
testConfig.sitePath = sitePathServer;

const abortController = new AbortController();
const appState = new AppState(testConfig);

try { 
    emptyDirSync(appState.sitePath.rootPath);
    await appState.sitePath.ensureDirs(); 
} catch { /** */ }

copySync(path.join(__dirname, '../data/getpayments_sessions'), 
    path.join(sitePathServer,'sessions'), { overwrite: true });

const siteDb = appState.openSiteDb();
siteDb.meta.setValue('$.config.authKeyHash', sha256hex(authKey));

const serverClosed = serveSite(appState, { abortSignal: abortController.signal });
const apiClient = new ApiClient(urlPrefix, authKey, abortController.signal);

try {

    // init client db
    const cmd = new CommandRunner(testPath);
    {
        const result = await cmd.run(execPath, 'init', '--sitePath', sitePathLocal, '--authKey', authKey, '--siteUrl', urlPrefix, '--xprv', xPrv);
        assertEquals(result.status.success, true);
        assertEquals(result.status.code, 0);
        assertEquals(result.stdErrText, '');
    }
    {
        const cwdRelativePath = path.join(__dirname, '../data/paywalls.json');
        const res = await apiClient.files.upload(cwdRelativePath, '/paywalls.json')
        await res.text();
    }
    {
        const cwdRelativePath = path.join(__dirname, '../data/xpub.txt');
        const res = await apiClient.files.upload(cwdRelativePath, '/xpub.txt')
        await res.text();
    }

    // generate paid invoices, however after running it I saved the prefilled db (from the test dir)
    // put this in a separate generate_data.ts script
    // const cookyFetch1 = CookyFetch();
    // const cookyFetch2 = CookyFetch();
    // const cookyFetch3 = CookyFetch();
    // for (const cookyFetch of [cookyFetch1,cookyFetch2,cookyFetch3]){
    //     let invoice;
    //     // get cookie
    //     {   
    //         const res = await cookyFetch(urlPrefix+'/elephant.jpg', { signal: abortController.signal });
    //         assertEquals(res.status, 200);
    //         await res.text();
    //     }
    //     // get invoice
    //     {
    //         const res = await cookyFetch(urlPrefix+'/.bip270/inv', { 
    //             signal: abortController.signal, 
    //             method: 'POST',
    //             headers:{ 'Content-Type': 'application/x-www-form-urlencoded' },    
    //             body: new URLSearchParams({ urlPath: '/elephant.jpg' })
    //         });

    //         assertEquals(res.status, 200);
    //         const body = await res.json();
    //         assertEquals(body.ref !== undefined, true);
    //         invoice = body;
    //     }
    //     {
    //         const res = await cookyFetch(urlPrefix+'/.bip270/inv/devpay?ref='+invoice.ref, { signal: abortController.signal });
    //         assertEquals(res.status, 200);

    //         const body = await res.text();
    //         assertStringIncludes(body, '');
    //     }
    // }

    {
        await appState.copyFromSessionDbs(abortController.signal);
        const siteDb = appState.openSiteDb();
        assertEquals(siteDb.invoices.listInvoices().length, 3);
    }
    {
        const result = await cmd.run(execPath, 'getpayments', '--sitePath', sitePathLocal);
        assertEquals(result.status.success, true);
        assertEquals(result.status.code, 0);
        assertEquals(result.stdErrText, '');
    }
    {
        const dbPath = path.join(sitePathLocal, 'sweb.db');
        const localSiteDb = openDb(ClientSiteDbModule, dbPath);
        assertEquals(localSiteDb.invoices.listInvoices().length, 3);
    }
} catch (error) {
    throw error;
} finally {
    abortController.abort();
    await serverClosed;
    appState.close();
}

console.log(testName, 'passed');
