import { copySync, emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';
import bsv from "npm:bsv";

import { CommandRunner } from '/test/commandrunner.ts';
import { openDb } from '/lib/database/mod.ts';
import SwebDbModule from "/client/swebdb.ts";

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const sitePath = path.join(testPath, 'example');
emptyDirSync(sitePath);
copySync(path.join(__dirname, '../data/gotpayments_sweb.db'), path.join(sitePath,'sweb.db'), { overwrite: true });

const execPath = path.join(__dirname, '../swebcli');
const cmd = new CommandRunner(testPath);

let tx;
const txPath = path.join(testPath,'tx.bin');

{
    const result = await cmd.run(execPath, 'redeem', '12tPpMWubbAnbSfbtVr9NJBP526W9aKppt', '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
    tx = bsv.Tx.fromHex(result.stdOutText.trim());
    Deno.writeFileSync(txPath, tx.toBuffer());
}

const swebDb = openDb(SwebDbModule, path.join(sitePath,'sweb.db'));
const list = swebDb.outputs.list().filter(x => x.redeemTxHash === null);
assertEquals(list.length, 3);

{
    const result = await cmd.run(execPath, 'processtx', txPath, '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');

    const list = swebDb.outputs.list().filter(x => x.redeemTxHash);
    assertEquals(list.length, 3);
}

console.log(testName, 'passed');