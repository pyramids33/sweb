import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";

import bsv from "npm:bsv";

import SwebDbModule from "./swebdb.ts";
import { InvoiceRow, InvoiceSpec } from "./invoicesdb.ts";

import { openDb } from "/lib/database/mod.ts";
import { tryStatSync } from "/lib/trystat.ts";
import { SiteMap } from "./sitemap.ts"
import { paywallsCmd } from "./cli_paywallscmd.ts"

import { 
    uploadCmd, 
    downloadCmd, 
    deleteCmd, 
    infoCmd, 
    renameCmd 
} from "./cli_apicmds.ts"

import { 
    check200JsonResponse,
    configOptions,
    reIndexSiteMap,  
    ServerFileRow,
    tryGetApiClient,
    tryOpenDb,
    validateXprv,
    validateFormat
} from "./cli_helpers.ts"

import { buildTransaction } from "./txbuild.ts";


/*
init
sitemap
config --authKey --siteUrl
config show
hdkey --xprv --xpub --random
paywalls add <pattern> <amount> [description] [address or paymail]
paywalls remove <pattern> <outputNum>
paywalls show
reindex
diff
publish
getpayments
upload
download
info
delete
rename
*/

export const mainCmd = new commander.Command('sweb');
mainCmd.requiredOption('-s --sitePath <sitePath>', 'path to local site root', '.');

mainCmd.command('init')
.addOption(configOptions.siteUrl)
.addOption(configOptions.authKey)
.option('--xprv <xprv>', 'Bip32 Private Key xprv... ', validateXprv)
.option('--passphrase <passphrase>', 'passphrase for generated bitcoin seed')
.description('Create a new site database. ')
.action(async (options, _cmd) => {
    const sitePath = mainCmd.opts().sitePath;
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
    await reIndexSiteMap(siteMap, swebDb);

    swebDb.db.close();
});


mainCmd.command('sitemap')
.option('--no-reindex', 'skip indexing of local files')
.option('--format <format>', 'output format', validateFormat, 'text')
.description('show site map by walking sitePath')
.action(async (options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath)

    if (options.reindex) {
        const siteMap = new SiteMap(sitePath);
        await reIndexSiteMap(siteMap, swebDb);
    }

    const filesList = swebDb.files.local.listFiles();

    if (options.format === 'text') {
        for (const fileRow of filesList) {
            console.log(fileRow.urlPath, '=>', fileRow.storagePath, fileRow.mimeType, fileRow.size, fileRow.hash.slice(0,4)+'...'+fileRow.hash.slice(-4));
        }
    } else if (options.format === 'json') {
        console.log(JSON.stringify(filesList,null,2));
    }
    swebDb.db.close();
});


mainCmd.command('reindex')
.option('-l --local', 'reindex the local files')
.option('-s --server', 'get current file list from server')
.description('Reindex file information')
.action(async (options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const siteMap = new SiteMap(sitePath);
    const swebDb = tryOpenDb(sitePath)

    if (options.local) {
        const changes = await reIndexSiteMap(siteMap, swebDb);
        for (const item of changes.upserts) {
            console.log('new/updated', item.urlPath);
        }
        for (const item of changes.deletions) {
            console.log('deleted', item);
        }
        for (const item of changes.missing) {
            console.log('missing', item.urlPath);
        }
    }

    if (options.server) {
        const apiClient = tryGetApiClient(swebDb);
        const response = await apiClient.files.list()
        const responseObj = await check200JsonResponse(response);
        
        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        swebDb.db.transaction(function () {
            swebDb.files.server.deleteAll();
            for (const f of responseObj as ServerFileRow[]) {
                swebDb.files.server.upsertFile(f);
            }
        })(null);

        console.log('server', responseObj);
    }
    swebDb.db.close();
});


mainCmd.command('diff')
.description('Compare local files to server files. (performs local reindex)')
.action(async (_options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath);
    const siteMap = new SiteMap(sitePath);
    await reIndexSiteMap(siteMap, swebDb);

    const { deletions, renames, uploads } = swebDb.files.compareLocalToServer();

    for (const item of deletions) {
        console.log('delete', item.urlPath);
    }
    for (const item of renames) {
        console.log('rename', item.server.urlPath, item.local.urlPath);
    }
    for (const item of uploads) {
        console.log('upload', item.urlPath);
    }
    swebDb.db.close();
});


mainCmd.command('publish')
.description('Sync files to server. (Local reindex, diff, then upload/delete/rename)')
.action(async (_options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath);
    const siteMap = new SiteMap(sitePath);
    
    console.log('reindexing...');
    await reIndexSiteMap(siteMap, swebDb);

    console.log('comparing...');
    const apiClient = tryGetApiClient(swebDb);
    
    const { deletions, renames, uploads } = swebDb.files.compareLocalToServer();

    {
        console.log('deletions... ' + deletions.length.toString());
        const deleteList = deletions.map(x => x.urlPath);
        const response = await apiClient.files.delete(deleteList.join('\n'));
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        swebDb.files.server.deleteList(...deleteList);
    }

    {
        console.log('renames... ' + renames.length.toString());
        const renameList = renames.map(x => [ x.server.urlPath, x.local.urlPath ] as [string,string]);
        const response = await apiClient.files.rename(renameList.map(x => x.join('\n')).join('\n'));
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        swebDb.files.server.renameList(renameList);
    }

    {
        console.log('uploads... ' + uploads.length.toString());
        for (const item of uploads) {
            const { urlPath, hash, size, storagePath, mimeType } = item;
            const cwdRelativePath = path.join(sitePath, storagePath);
            const response = await apiClient.files.upload(cwdRelativePath, urlPath, hash, size, mimeType);
            const responseObj = await check200JsonResponse(response);

            if (responseObj.error) {
                console.error(responseObj);
                Deno.exit(1);
            }

            swebDb.files.server.upsertFile(item);
        }
    }
    swebDb.db.close();
});


mainCmd.command('getpayments')
.description('Download invoices from server')
.action(async (_options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath);
    const apiClient = tryGetApiClient(swebDb);

    let deleteList:string[] = [];

    while (true) {
        
        const response = await apiClient.invoices.transfer(deleteList.join('\n'), true);
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            break;
        }

        deleteList = [];
        
        const invoices = responseObj.map((x) => { 
            return { ...x, txbuf: (x.txbuf ? bsv.deps.Buffer.from(x.txbuf, 'hex') : undefined) } 
        }) as InvoiceRow[];

        //console.log(invoices);
        
        if (invoices.length === 0) {
            break;
        }

        const sum = invoices.reduce((p,c) => p + c.subtotal, 0);

        console.log('received '+invoices.length+' invoices. (' + sum.toString() + ' sats)')
        
        for (const invoice of invoices) {        
            swebDb.db.transaction(function () {
                swebDb.invoices.addInvoice(invoice);
                
                if (invoice.txbuf === undefined) {
                    console.error('missing tx: '+invoice.ref)
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

                    txOuts[invTxOutNum] = undefined;

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
    }
    swebDb.db.close();
});

mainCmd.command('redeem')
.description('create tx spending to address')
.argument('<address>', 'destination address')
.action((addressTo, _options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath);
    const tx = buildTransaction(swebDb, bsv.Address.fromString(addressTo));

    // broadcast
    // update database

    console.log(tx.toString());
    swebDb.db.close();
});
mainCmd.command('processtx')
.description('mark outputs as spent')
.argument('<txFile>', 'path to tx file')
.action((txFilePath, _options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath);
    
    const txbuf = Deno.readFileSync(txFilePath);
    const tx = bsv.Tx.fromBuffer(bsv.deps.Buffer.from(txbuf));
    
    for (const [ nIn, txIn ] of tx.txIns.entries()) {
        swebDb.outputs.markSpent(
            txIn.txHashBuf.toString('hex'), 
            txIn.txOutNum, 
            tx.hash().toString('hex'),
            nIn
        );
    }
    swebDb.db.close();
});


const configCmd = mainCmd.command('config')
.addOption(configOptions.siteUrl)
.addOption(configOptions.authKey)
.option('--no-siteUrl', 'remove siteUrl config')
.option('--no-authKey', 'remove authKey config')
.description('Set configuration options')
.action((options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath);

    for (const name of ['authKey','siteUrl']) {
        const key = '$.config.'+name;

        if (options[name]) {
            swebDb.meta.setValue(key, options[name]||null);
        }

        if (options[name] === false) {
            swebDb.meta.removeValue(key);
        }
    }
    swebDb.db.close();
});

configCmd.command('show')
.option('-n, --names <names...>', 'specify names, or dont to show all')
.description('show config from db')
.action((options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath)
    
    console.log('config: '+sitePath)
    
    const config = swebDb.getConfig();
    
    for(const [name,value] of Object.entries(config)) {
        if (options.names === undefined || options.names?.includes(name)) {
            console.log('  '+name,'=',value);
        }
    }
    swebDb.db.close();
});


mainCmd.command('hdkey')
.description('Generate a new hd key (bip32)')
.option('--random', 'generate random key (seed will be printed)')
.option('--passphrase <passphrase>', 'passphrase for generated bitcoin seed')
.option('--xprv <xprv>', 'Bip32 Private Key xprv... ', validateXprv)
.action((options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
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

mainCmd.addCommand(paywallsCmd);

// not implemented
mainCmd.addCommand(uploadCmd);
mainCmd.addCommand(downloadCmd);
mainCmd.addCommand(deleteCmd);
mainCmd.addCommand(infoCmd);
mainCmd.addCommand(renameCmd);
