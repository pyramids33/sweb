import * as commander from "npm:commander";
import bsv from "npm:bsv";
import * as path from "/deps/std/path/mod.ts";

import { 
    sitePathOption,
    tryOpenDb,
    validateXprv,
} from "./helpers.ts"


export const setHdKeyCmd = new commander.Command('set-hdkey')
.description('Generate a new hd key (bip32)')
.addOption(sitePathOption)
.option('--random', 'generate random key (seed will be printed)')
.option('--passphrase <passphrase>', 'passphrase for generated bitcoin seed')
.option('--xprv <xprv>', 'Bip32 Private Key xprv... ', validateXprv)
.action((options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);

    let xprv:bsv.Bip32;

    if (options.xprv) {
        xprv = options.xprv;
    } else if (options.random) {
        const bip39 = bsv.Bip39.fromRandom();
        xprv = bsv.Bip32.fromSeed(bip39.toSeed(options.passphrase));

        console.log('xpub: ', xprv.toPublic().toString());
        console.log('mnemonic: ', bip39.mnemonic);
    }

    if (xprv) {
        swebDb.meta.setValue('$.hdkeys.'+xprv.toPublic().toString(), xprv.toString());
        Deno.writeTextFileSync(path.join(sitePath,'xpub.txt'), xprv.toPublic().toString());
    }
    
    swebDb.db.close();
});
