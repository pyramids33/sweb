import bsv from "npm:bsv";

import { SwebDbApi } from "./swebdb.ts";

export function buildTransaction (swebDb:SwebDbApi, addressTo:bsv.Address) : bsv.Tx {

    const feePerKbNum = bsv.Constants.Default.TxBuilder.feePerKbNum;
    const hashCache = {};
    const invOutputs = [];

    let lastRowId = 0;
    
    const tx = new bsv.Tx();
    tx.addTxOut(new bsv.Bn(0), addressTo.toTxOutScript())

    while (true) {
        const invOutput = swebDb.outputs.nextUnspentOutput(lastRowId)
        
        if (invOutput === undefined || invOutputs.length === 1000) {
            break;
        }

        if (invOutput.invTxHash) {
            lastRowId = invOutput.rowid!;
            invOutputs.push(invOutput);
            tx.addTxIn(bsv.deps.Buffer.from(invOutput.invTxHash,'hex'), invOutput.invTxOutNum, new bsv.Script());
        }
    }

    const valueIn = new bsv.Bn(invOutputs.reduce((p,c) => p + c.amount, 0));
    const estimatedSize = tx.toBuffer().length + (107 * tx.txIns.length);
    const estimatedFee = new bsv.Bn(Math.ceil(estimatedSize / 1000 * feePerKbNum));

    tx.txOuts[0].valueBn = valueIn.sub(estimatedFee);

    for (const [nIn, txIn] of tx.txIns.entries()) {
        const utxoInfo = invOutputs[nIn];
        const xprvstr = swebDb.meta.getValue('$.hdkeys.'+utxoInfo.xpubstr);
        const privKey = bsv.Bip32.fromString(xprvstr).derive(utxoInfo.drvpath).privKey;
        const keyPair = bsv.KeyPair.fromPrivKey(privKey);

        const sig = tx.sign(
            keyPair, 
            bsv.Sig.SIGHASH_ALL | bsv.Sig.SIGHASH_FORKID, 
            nIn, 
            bsv.Script.fromHex(utxoInfo.script), 
            new bsv.Bn(utxoInfo.amount), 
            bsv.Tx.SCRIPT_ENABLE_SIGHASH_FORKID, 
            hashCache);
    
        const script = new bsv.Script();
        script.writeBuffer(sig.toTxFormat());
        script.writeBuffer(keyPair.pubKey.toBuffer());
        txIn.setScript(script);
    }

    return tx;
}


