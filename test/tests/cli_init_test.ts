import { emptyDirSync, ensureDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals, assertStringIncludes } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import { CommandRunner } from '../commandrunner.ts';
import { authKey, urlPrefix } from '../testconfig.ts';

import SwebDbModule, { Config } from "/client/database/swebdb.ts";
import { openDb } from "/lib/database/mod.ts";

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const sitePath = path.join(testPath, 'example');
ensureDirSync(sitePath);

// run sweb client command line utility
const execPath = path.join(__dirname, '../swebcli');
const cmd = new CommandRunner(testPath);

const result = await cmd.run(
    execPath, 'init', 
    '--sitePath', sitePath,
    '--authKey', authKey,
    '--siteUrl', urlPrefix 
);

assertEquals(result.status.success, true);
assertEquals(result.status.code, 0);
assertEquals(result.stdErrText, '');
assertStringIncludes(result.stdOutText, 'xpub:  xpub');
assertStringIncludes(result.stdOutText, 'mnemonic:  ');

// inspect client file database
const dbPath = path.join(testPath, 'example','sweb.db');
const swebDb = openDb(SwebDbModule, dbPath, { create: false });

// config should equal
const config = swebDb.meta.getValue('$.config') as Config;
assertEquals(config, { siteUrl: "http://127.0.0.1:8098", authKey: "aabbccddee" })

// xpub file was created
const xpubText = Deno.readTextFileSync(path.join(sitePath, 'xpub.txt'));
assertEquals(xpubText.slice(0,4), 'xpub');

swebDb.db.close();

console.log(testName, 'passed');