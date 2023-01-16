import * as commander from "npm:commander";
import bsv from "npm:bsv";
import * as path from "/deps/std/path/mod.ts";

import { openDb } from "/lib/database/mod.ts";
import { tryStatSync } from "/lib/trystat.ts";

import SwebDbModule from "/client/database/swebdb.ts";
import { SiteMap } from "/client/sitemap.ts"

import { 
    configOptions,
    sitePathOption,
    validateXprv,
} from "./helpers.ts"

import { reindexFiles } from "/client/reindex.ts";

export const initCmd = new commander.Command('init')
.addOption(sitePathOption)
.addOption(configOptions.siteUrl)
.addOption(configOptions.authKey)
.option('--xprv <xprv>', 'Bip32 Private Key xprv... ', validateXprv)
.option('--passphrase <passphrase>', 'passphrase for generated bitcoin seed')
.description('Create a new site database. ')
.action(async (options) => {
    const sitePath = options.sitePath;
    const dbPath = path.join(sitePath, 'sweb.db');

    const stat = tryStatSync(dbPath);

    if (stat && stat.isFile) {
        console.log('File already exists.');
        Deno.exit(1);
    }

    const swebDb = openDb(SwebDbModule, dbPath);
 
    swebDb.meta.setValue('$.config.siteUrl', options.siteUrl);
    swebDb.meta.setValue('$.config.authKey', options.authKey);

    let xprv:bsv.Bip32;

    if (options.xprv) {
        xprv = options.xprv;
    } else {
        const bip39 = bsv.Bip39.fromRandom();
        xprv = bsv.Bip32.fromSeed(bip39.toSeed(options.passphrase));

        console.log('xpub: ', xprv.toPublic().toString());
        console.log('mnemonic: ', bip39.mnemonic);
    }

    swebDb.meta.setValue('$.hdkeys.'+xprv.toPublic().toString(), xprv.toString());

    Deno.writeTextFileSync(path.join(sitePath,'xpub.txt'), xprv.toPublic().toString());

    const siteMap = new SiteMap(sitePath);
    await reindexFiles(siteMap, swebDb);

    swebDb.db.close();
});
