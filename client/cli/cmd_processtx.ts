import * as commander from "npm:commander";
import bsv from "npm:bsv";

import { 
    sitePathOption,
    tryOpenDb,
} from "./helpers.ts"

import { processTransaction } from "../transactions.ts";


export const processTxCmd = new commander.Command('process-tx')
.description('process a tx, marking outputs as spent. (the tx should have already been broadcast)')
.addOption(sitePathOption)
.option('-t --txid <txid>', 'id of transaction to download ')
.option('-f --filePath <filePath>', 'file path of the transaction')
.action(async (options) => {
    const sitePath = options.sitePath;

    let tx;
    
    if (options.filePath) {
        const txbuf = Deno.readFileSync(options.filePath);
        tx = bsv.Tx.fromBuffer(bsv.deps.Buffer.from(txbuf));
    } else if (options.txid) {
        const res = await fetch('https://api.whatsonchain.com/v1/bsv/main/tx/'+options.txid);
        if (res.ok) {
            const bodyText = await res.text();
            tx = bsv.Tx.fromHex(bodyText);
        } else {
            console.error(res.statusText);
            Deno.exit(1);
        }
    }

    if (tx === undefined) {
        console.error('error: unable to source transaction');
    }

    const swebDb = tryOpenDb(sitePath);
    processTransaction(swebDb, tx);
    swebDb.db.close();
});
