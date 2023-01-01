import { emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals, assertStringIncludes } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import { CommandRunner } from '../commandrunner.ts';

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const execPath = path.join(__dirname, '../../client/denosweb');
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
const sitePath = path.join(testPath, 'example');
emptyDirSync(testPath);

const cmd = new CommandRunner(testPath);

const result = await cmd.run(
    execPath, 'init', 
    '--sitePath', sitePath,
    '--authKey', 'aabbccddee',
    '--siteUrl', 'http://localhost:8098/' 
);

const xpubText = Deno.readTextFileSync(path.join(sitePath, 'xpub.txt'));

assertEquals(result.status.success, true);
assertEquals(result.status.code, 0);
assertEquals(result.stdErrText, '');
assertStringIncludes(result.stdOutText, 'xpub:  '+xpubText);
assertStringIncludes(result.stdOutText, 'mnemonic:  ');


console.log(testName, 'passed');