import { copySync, emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals, assertStringIncludes } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';
import { Buffer } from "/deps/std/node/buffer.ts";

import { sha256hex } from "/lib/hash.ts";
import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";

import { testConfig, urlPrefix, authKey, xPrv } from "/test/testconfig.ts";
import { CookyFetch } from '/test/cookyfetch.ts';

import { CommandRunner } from '../commandrunner.ts';


// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const sitePathLocal = path.join(testPath, 'example');
copySync(path.join(__dirname, '../data/example'), sitePathLocal, { overwrite: true });

const execPath = path.join(__dirname, '../swebcli');

const sitePathServer = path.join(testPath, 'site');
testConfig.sitePath = sitePathServer;

const abortController = new AbortController();
const appState = new AppState(testConfig);

try { 
    emptyDirSync(appState.sitePath.rootPath);
    await appState.sitePath.ensureDirs(); 
} catch { /** */ }

const siteDb = appState.openSiteDb();
siteDb.meta.setValue('$.config.authKeyHash', sha256hex(Buffer.from(authKey,'hex')));

// add data which will need to be deleted/renamed on publish
siteDb.files.upsertFile({
    urlPath: "/elephant-rename.jpg",
    hash: "ff831c52eddc18746f40fbfcb85aaf1e9bde04634d0062683ee1fc29935af49e",
    size: 104048,
    mimeType: "image/jpeg",
    storagePath: "0ea04b11bde273c67579b14515a2a0bd99983871.bin"
});

siteDb.files.upsertFile({
    urlPath: "/elephant-removed.jpg",
    hash: "ef831c52eddc18746f40fbfcb85aaf1e9bde04634d0062683ee1fc29935af49e",
    size: 104048,
    mimeType: "image/jpeg",
    storagePath: "2ea04b11bde273c67579b14515a2a0bd99983871.bin"
});

const serverClosed = serveSite(appState, { abortSignal: abortController.signal });

const cookyFetch = CookyFetch();

try {

    const cmd = new CommandRunner(testPath);

    await cmd.run(
        execPath, 'init', 
        '--sitePath', sitePathLocal,
        '--authKey', authKey,
        '--siteUrl', urlPrefix,
        '--xprv', xPrv
    );

    await cmd.run(execPath, 'reindex-files', '--server', '--sitePath', sitePathLocal);
    const result = await cmd.run(execPath, 'publish', '--sitePath', sitePathLocal);

    //console.log(result.status);
    //console.log(result.stdErrText);
    //console.log(result.stdOutText);

    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
    assertStringIncludes(result.stdOutText, 'deletions... 1');
    assertStringIncludes(result.stdOutText, 'renames... 1');
    assertStringIncludes(result.stdOutText, 'uploads... 11');

    assertEquals(siteDb.files.listFiles().length, 12);

    {   
        const res = await cookyFetch(urlPrefix+'/docs2/test_file2.txt', { signal: abortController.signal });
        assertEquals(res.status, 200);

        const body = await res.text();
        assertEquals(body.includes('No Cookie'), true);
    }
    {
        const res = await cookyFetch(urlPrefix+'/docs2/test_file2.txt', { signal: abortController.signal });
        assertEquals(res.status, 200);

        await res.blob();
    }

} catch (error) {
    throw error;
} finally {
    appState.sse.close();
    abortController.abort();
    await serverClosed;
    appState.closeDbs();
}

console.log(testName, 'passed');
