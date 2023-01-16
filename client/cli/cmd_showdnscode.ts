import * as commander from "npm:commander";

import { hexToBuffer } from "/deps/hextools/src/hex_to_buffer.ts";
import { concat } from "/deps/std/bytes/concat.ts";

import { sha256hex } from "/lib/hash.ts";

import { 
    sitePathOption,
    tryOpenDb,
} from "./helpers.ts"


export const showDnsCodeCmd = new commander.Command('show-dnscode')
.description('prints the dns authorization code to be put in your domains dns TXT record')
.addOption(sitePathOption)
.action((options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const authKey = swebDb.meta.getValue('$.config.authKey') as string;
    const dnsAuthKey = sha256hex(concat(new TextEncoder().encode('swebdns'), new Uint8Array(hexToBuffer(authKey))));

    console.log(dnsAuthKey);
    //const txtRecords = await Deno.resolveDns('sweb.lol', 'TXT');
    //console.log(txtRecords)
    //console.log(txtRecords.flat().find(x => x === dnsAuthKey) !== undefined)
    swebDb.db.close();
});

