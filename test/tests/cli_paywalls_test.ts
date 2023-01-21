import { copySync, emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import { CommandRunner } from '/test/commandrunner.ts';
import { urlPrefix, authKey, xPrv } from "/test/testconfig.ts";
import { PaywallFile } from "/lib/paywallfile.ts";

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
{
    const result = await cmd.run(execPath, 'add-paywall', '/docs/', '5000', 'deez', '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
}
{
    const result = await cmd.run(execPath, 'add-paywall', '/docs/', '5001', 'nutz', '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
}
{
    const result = await cmd.run(execPath, 'add-paywall', '/docs2/test_file1.txt', '5001', 'files', '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
}
{
    const result = await cmd.run(execPath, 'add-paywall', '/docs2/test_file1.txt', '5002', 'files', '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
}
{
    const jsonString = Deno.readTextFileSync(path.join(sitePath,'paywalls.json'));
    const paywallFile = PaywallFile.fromJSON(jsonString);
    assertEquals(paywallFile.toJSON(), {
        "/docs": {
            outputs: [
                { amount: 5000, address: undefined, description: "deez" },
                { amount: 5001, address: undefined, description: "nutz" }
            ]
        },
        "/docs2/test_file1.txt": {
            outputs: [
                { amount: 5001, address: undefined, description: "files" },
                { amount: 5002, address: undefined, description: "files" }
            ]
        }
    });
}
{
    const result = await cmd.run(execPath, 'remove-paywall', '/docs2/test_file1.txt', '2', '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
}
{
    const jsonString = Deno.readTextFileSync(path.join(sitePath,'paywalls.json'));
    const paywallFile = PaywallFile.fromJSON(jsonString);
    assertEquals(paywallFile.toJSON(), {
        "/docs": {
            outputs: [
                { amount: 5000, address: undefined, description: "deez" },
                { amount: 5001, address: undefined, description: "nutz" }
            ]
        },
        "/docs2/test_file1.txt": {
            outputs: [
                { amount: 5001, address: undefined, description: "files" },
            ]
        }
    })
}
{
    const result = await cmd.run(execPath, 'remove-paywall', '/docs', 'a', '--sitePath', sitePath);
    assertEquals(result.status.success, true);
    assertEquals(result.status.code, 0);
    assertEquals(result.stdErrText, '');
}
{
    const jsonString = Deno.readTextFileSync(path.join(sitePath,'paywalls.json'));
    const paywallFile = PaywallFile.fromJSON(jsonString);
    assertEquals(paywallFile.toJSON(), {
        "/docs2/test_file1.txt": {
            outputs: [
                { amount: 5001, address: undefined, description: "files" }
            ]
        }
    })
}


console.log(testName, 'passed');