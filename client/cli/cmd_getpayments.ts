import * as commander from "npm:commander";
import bsv from "npm:bsv";

import { InvoiceRow, InvoiceSpec } from "../database/invoicesdb.ts";

import { 
    check200JsonResponse,
    sitePathOption,
    tryGetApiClient,
    tryOpenDb,
} from "./helpers.ts"

type InvoiceTransferRow = Omit<InvoiceRow, 'txbuf'> & { txbuf: string; }

export const getPaymentsCmd = new commander.Command('get-payments')
.description('Download invoices from server')
.addOption(sitePathOption)
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const apiClient = tryGetApiClient(swebDb);

    let lastRefReceived = '';
    let deleteList:string[] = [];

    while (true) {
        
        const response = await apiClient.invoices.transfer(deleteList.join('\n'), true);
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            break;
        }

        deleteList = [];
        
        const invoices = responseObj.map((x:InvoiceTransferRow) => { 
            return { ...x, txbuf: (x.txbuf ? bsv.deps.Buffer.from(x.txbuf, 'hex') : undefined) } 
        }) as InvoiceRow[];

        //console.log(invoices);

        // prevent infinite loop, should not get the same twice
        if (invoices.length > 0) {
            if (invoices[0].ref === lastRefReceived) {
                break;
            }
            lastRefReceived = invoices[0].ref;
        }

        console.log('received '+invoices.length+' invoice payments.');

        if (invoices.length === 0) {
            break;
        }

        let paidSum = 0;
        let paidCount = 0;
        let unpaidCount = 0;
        
        for (const invoice of invoices) {        

            if (invoice.paidAt) {
                paidCount += 1;
                paidSum += invoice.subtotal||0;
            } else {
                unpaidCount += 1;
            }

            swebDb.db.transaction(function () {
                swebDb.invoices.addInvoice(invoice);
                
                if (invoice.txbuf === undefined) {
                    return;
                }

                const invoiceSpec:InvoiceSpec = JSON.parse(invoice.spec);
                const tx:bsv.Tx = bsv.Tx.fromBuffer(invoice.txbuf);
                const txOuts = [...tx.txOuts];
                const txHash = tx.hash().toString('hex');

                for (const specItem of invoiceSpec.outputs) {

                    const invTxOutNum = txOuts.findIndex((txOut) => 
                        txOut !== undefined &&
                        specItem.amount === txOut.valueBn.toNumber() && 
                        specItem.script === txOut.script.toHex());

                    if (invTxOutNum === -1) {
                        // shouldnt happen if server validates
                        console.error('missing output: '+invoice.ref)
                        continue;
                    }

                    txOuts[invTxOutNum] = undefined; // only match it once

                    swebDb.outputs.addOutput({
                        invTxHash: txHash,
                        invoiceRef: invoice.ref,
                        invTxOutNum,
                        amount: specItem.amount,
                        drvpath: specItem.drvpath,
                        xpubstr: specItem.xpubstr,
                        script: specItem.script,
                        description: specItem.description  
                    });
                }
            })(null);  

            deleteList.push(invoice.ref); 
        }

        console.log(paidCount.toString() + ' paid, ' + paidSum.toString() + ' sats)');
        console.log(unpaidCount.toString() + ' unpaid. ');
    }
    swebDb.db.close();
});