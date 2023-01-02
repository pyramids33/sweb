import { copySync, emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import { CommandRunner } from '/test/commandrunner.ts';
import { urlPrefix, authKey, xPrv } from "/test/testconfig.ts";

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const sitePath = path.join(testPath, 'example');
copySync(path.join(__dirname, '../data/example'), sitePath, { overwrite: true });

const execPath = path.join(__dirname, '../swebcli');
const cmd = new CommandRunner(testPath);

await cmd.run(
    execPath, 'init', 
    '--sitePath', sitePath,
    '--authKey', authKey,
    '--siteUrl', urlPrefix,
    '--xprv', xPrv
);

const result = await cmd.run(execPath, 'sitemap', '--format','json', '--sitePath', sitePath);

const expected = [
    {
      "urlPath": "/5starshotel.jpeg",
      "hash": "eaab6d7f945b71fa51fc9e4a0c6ee3e6dfe535bb1fe750cf635add2c30ed483a",
      "size": 9543,
      "storagePath": "5starshotel.jpeg",
      "mimeType": "image/jpeg",
    },
    {
        "hash": "54f1b51d0281cf946cc1d4c525639c7aa7d5bcecd6c42a2e58351e319c266246",
        "mimeType": "text/html; charset=UTF-8",
        "size": 51,
        "storagePath": "docs/index.html",
        "urlPath": "/docs/",
    },
    {
      "urlPath": "/docs/name%20with%20sp.txt",
      "hash": "b5b76c917a6b7fd09e0ba2d750147fe440d552f985e793941ba5da2d305e6227",
      "size": 25,
      "storagePath": "docs/name with sp.txt",
      "mimeType": "text/plain; charset=UTF-8"
    },
    {
      "urlPath": "/docs/subdoc/index.md",
      "hash": "881ecea8b55a2886795903205e959de11bb4b768406c67f903d206e70262e829",
      "size": 41,
      "storagePath": "docs/subdoc/index.md",
      "mimeType": "text/markdown; charset=UTF-8"
    },
    {
      "urlPath": "/docs/test_file2.txt",
      "hash": "1cade651ad376ccfd2e0c81c60311155f6b0e6a7f58a6202bfe6b5ba6c25fd61",
      "size": 27,
      "storagePath": "docs/test_file2.txt",
      "mimeType": "text/plain; charset=UTF-8"
    },
    {
      "urlPath": "/docs/test_file3.txt",
      "hash": "2005eb0a0d4dfa9cbe2c6b5a04d3187eb0825a0ea81cfdba506e8a3f4d2d0a63",
      "size": 24,
      "storagePath": "docs/test_file3.txt",
      "mimeType": "text/plain; charset=UTF-8"
    },
    {
      "urlPath": "/docs2/test_file1.txt",
      "hash": "124838f79fb0db37d9f957f7da9542c0ad8fb031a8cde269cde3f57016374caa",
      "size": 24,
      "storagePath": "docs2/test_file1.txt",
      "mimeType": "text/plain; charset=UTF-8"
    },
    {
      "urlPath": "/docs2/test_file2.txt",
      "hash": "ede3b42d80a1392827b63d7f67cd0de941846465ecbbc6b94ac3e8be81a2defc",
      "size": 26,
      "storagePath": "docs2/test_file2.txt",
      "mimeType": "text/plain; charset=UTF-8"
    },
    {
      "urlPath": "/elephant.jpg",
      "hash": "ff831c52eddc18746f40fbfcb85aaf1e9bde04634d0062683ee1fc29935af49e",
      "size": 104046,
      "storagePath": "elephant.jpg",
      "mimeType": "image/jpeg"
    },
    {
      "urlPath": "/xpub.txt",
      "hash": "b00cd2afaba03f9ad9e317eb76e0569ba3c664e1d611bba714e7d4013e1bc2bb",
      "size": 111,
      "storagePath": "xpub.txt",
      "mimeType": "text/plain; charset=UTF-8"
    }
];

assertEquals(result.status.success, true);
assertEquals(result.status.code, 0);
assertEquals(result.stdErrText, '');

const actual = JSON.parse(result.stdOutText.trim()).map((x:Record<string,unknown>) => { delete x.mtime; return x; });

assertEquals(actual, expected);
assertEquals(result.stdErrText, '');

console.log(testName, 'passed');