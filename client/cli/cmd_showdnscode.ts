import * as commander from "npm:commander";
import { Buffer } from "/deps/std/node/buffer.ts";
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
    const dnsAuthKey = sha256hex(Buffer.concat([ Buffer.from('swebdns'), Buffer.from(authKey,'hex') ]));

    console.log(dnsAuthKey);
    //const txtRecords = await Deno.resolveDns('sweb.lol', 'TXT');
    //console.log(txtRecords)
    //console.log(txtRecords.flat().find(x => x === dnsAuthKey) !== undefined)
    swebDb.db.close();
});

