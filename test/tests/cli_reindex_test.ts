import { copySync, emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import { CommandRunner } from '../commandrunner.ts';

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const sitePath = path.join(testPath, 'example');
copySync(path.join(__dirname, '../data/example'), sitePath, { overwrite: true });
Deno.removeSync(path.join(sitePath, 'docs/index.html'));

const execPath = path.join(__dirname, '../swebcli');
const cmd = new CommandRunner(testPath);

await cmd.run(
    execPath, 'init', 
    '--sitePath', sitePath,
    '--authKey', 'aabbccddee',
    '--siteUrl', 'http://localhost:8098/',
    '--xprv', 'xprv9s21ZrQH143K2cPPDuqeQ3CNmufwyPWU4uUv12cEDzzhnvfqztGjhk8KyLDNnCpK1rB5jPMR9zFiY94sfvHARxxyXSwFWLdLNLFTtRCTBKt'
);

Deno.writeTextFileSync(path.join(sitePath, 'docs/test_file3.txt'), 'updated blah blah blah 10143 73737 873 738737');
copySync(path.join(__dirname, '../data/example/docs/index.html'), path.join(sitePath, 'docs/index.html'), { overwrite: true });
Deno.removeSync(path.join(sitePath, 'docs/test_file2.txt'));

const result = await cmd.run(execPath, 'reindex', '--local', '--sitePath', sitePath);

// console.log(result.status);
// console.log(result.stdErrText);
// console.log(result.stdOutText);

const expectedChanges = [
    'new/updated /docs/',
    'new/updated /docs/test_file3.txt',
    'deleted /docs/test_file2.txt',
    'missing /docs3/',
];

assertEquals(result.status.success, true);
assertEquals(result.status.code, 0);
assertEquals(result.stdErrText, '');
assertEquals(result.stdOutText.trim().split('\n'), expectedChanges)


console.log(testName, 'passed');