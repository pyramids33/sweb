import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";
import { bufferToHex } from "/deps/hextools/src/buffer_to_hex.ts";
import bsv from "npm:bsv";

import ClientSiteDbModule from "./clientsitedb.ts";
import type { ClientSiteDbApi } from "./clientsitedb.ts";
import { InvoiceRow } from "./invoicesdb.ts";
import { ApiClient } from "./apiclient.ts";
import { ChangeDetector, SiteMap } from "./sitemap.ts"

import { openDb } from "/lib/database/mod.ts";
import { tryStatSync } from "/lib/trystat.ts";
import { PaywallFile, PaywallSpec, PaywallSpecOutput } from "/lib/paywallfile.ts";
import { urlPrefix } from "../test/testconfig.ts";



interface ServerFileRow {
    urlPath:string
    hash:string
    size:number
    mimeType:string
}

function validateAuthKey (value:string) {
    if (value === 'r') {
        const buf = new Uint8Array(32);
        crypto.getRandomValues(buf);
        value = bufferToHex(buf)
    } else if (value && !/^(?:[a-f0-9]{2}){5,32}$/.test(value)) {
        throw new commander.InvalidArgumentError('Not a hex string 10-64 chars');
    }
    return value;
}

function validateUrl (value:string) : string {
    if (value) {
        if (!/[a-z]+\:\/\//.test(value)) {
            value = 'https://'+value;
        }
        if (!value.startsWith('https://') && !value.startsWith('http://')) {
            throw new commander.InvalidArgumentError('Invalid protocol');
        }
        try {
            return new URL(value).origin;
        } catch (error) {
            throw new commander.InvalidArgumentError(error.message);
        }
    }
    return value;
}

function validateXprv (value:string) : bsv.Bip32 {
    try {
        const key = bsv.Bip32.fromString(value);
        if (key.isPrivate()) {
            return key;
        }
        throw new commander.InvalidArgumentError('The key is not a private key.')
    } catch (error) {
        throw new commander.InvalidArgumentError(error.message);
    }
}

function tryOpenDb (dbPath:string) {
    try {
        return openDb<ClientSiteDbApi>(ClientSiteDbModule, dbPath, { create: false });
    } catch (error) {
        if (error.code === 'SQLITE_CANTOPEN') {
            console.error('Cannot open database: ' + dbPath);
            Deno.exit(1);
        }
        throw error;
    }
}

function tryGetApiClient (siteDb:ClientSiteDbApi, abortSignal?:AbortSignal) {
    const { siteUrl, authKey } = siteDb.getConfig();
    try {
        new URL(siteUrl!);
    } catch {
        console.error('Invalid or missing siteUrl. (run config command)');
        Deno.exit(1);
    }
    if (authKey === undefined) {
        console.error('Missing authKey. (run config command)');
        Deno.exit(1);
    }
    return new ApiClient(urlPrefix, authKey, abortSignal);
}

async function check200JsonResponse (response:Response) {
    // check response is status 200 with valid JSON, return
    // return response data as object
    if (!response.ok) {
        console.error('Error: ' + response.status.toString() + ' ' + response.statusText);
        Deno.exit(1);
    }

    let responseObj; 

    try {
        responseObj = await response.json();
    } catch {
        console.error('Error: invalid json response');
        Deno.exit(1);
    }

    return responseObj;
}

async function reIndexSiteMap (siteMap:SiteMap, siteDb:ClientSiteDbApi) {

    const changeDetector = new ChangeDetector(siteMap, siteDb);
    const results = await changeDetector.detectChanges();
    
    siteDb.db.transaction(function () {
        try {
            for (const file of results.upserts) {
                siteDb.files.local.upsertFile(file);
            }
            for (const urlPath of results.deletions) {
                siteDb.files.local.deleteFile(urlPath);
            }
        } catch (error) {
            if (!siteDb.db.inTransaction) {
                throw error; 
            }
        }
    })(null);

    return results;
}

// function prettyFiles (obj) {
//     // pretty print for getfiles command
//     let out = Object.keys(obj.files)
//         .sort()
//         .map(x => { return { ...obj.files[x], urlPath: x }});
//     console.table(out, ['urlPath','mimeType','size','hash']);
// }

const configOptions = {
    siteUrl: new commander.Option(
        '--siteUrl <siteUrl>', 
        'Url of your site. eg https://mysite.com/ ').argParser(validateUrl),

    authKey: new commander.Option(
        '--authKey <authKey>', 
        `Authentication key (10-64 character hex string). `+
        `type 'r' to generate at random. `).argParser(validateAuthKey),

    xprvKey: new commander.Option(
        '--xprvKey <xprvKey>', 
        `Bitcoin Bip32 private key (xprv...) `+
        `type 'r' to generate at random. `).argParser(validateAuthKey),  
};

/*
init
sitemap --walk

config --authKey --siteUrl
       show

hdkey --xprv --xpub --random

paywall add <pattern> <amount> [description] [address or paymail] [n]
        rem <pattern> <n>
        show --pattern --match

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

export const mainCmd = new commander.Command('db');
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

    const siteDb = openDb<ClientSiteDbApi>(ClientSiteDbModule, dbPath);
 
    siteDb.meta.setValue('$.config.siteUrl', options.siteUrl);
    siteDb.meta.setValue('$.config.authKey', options.authKey);

    let xprv:bsv.Bip32;

    if (options.xprv) {
        xprv = options.xprv;
    } else {
        const bip39 = bsv.Bip39.fromRandom();
        xprv = bsv.Bip32.fromSeed(bip39.toSeed(options.passphrase));

        console.log('xpub: ', xprv.toPublic().toString());
        console.log('mnemonic: ', bip39.mnemonic);
    }

    siteDb.meta.setValue('$.hdkeys.'+xprv.toPublic().toString(), xprv.toString());

    Deno.writeTextFileSync(path.join(sitePath,'xpub.txt'), xprv.toPublic().toString());

    const siteMap = new SiteMap(sitePath);
    await reIndexSiteMap(siteMap, siteDb);

});

function validateFormat (value:string) {
    if (['text','json'].includes(value)) {
        return value;
    }
    throw new commander.InvalidOptionArgumentError('valid option is text, json')
}

mainCmd.command('sitemap')
.option('--no-reindex', 'skip indexing of local files')
.option('--format <format>', 'output format', validateFormat, 'text')
.description('show site map by walking sitePath')
.action(async (options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'))

    if (options.reindex) {
        const siteMap = new SiteMap(sitePath);
        await reIndexSiteMap(siteMap, siteDb);
    }

    const filesList = siteDb.files.local.listFiles();

    if (options.format === 'text') {
        for (const fileRow of filesList) {
            console.log(fileRow.urlPath, '=>', fileRow.storagePath, fileRow.mimeType, fileRow.size, fileRow.hash.slice(0,4)+'...'+fileRow.hash.slice(-4));
        }
    } else if (options.format === 'json') {
        console.log(JSON.stringify(filesList,null,2));
    }
});


mainCmd.command('reindex')
.option('-l --local', 'reindex the local files')
.option('-s --server', 'get current file list from server')
.description('Reindex file information')
.action(async (options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const siteMap = new SiteMap(sitePath);
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'))

    if (options.local) {
        const changes = await reIndexSiteMap(siteMap, siteDb);
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
        const apiClient = tryGetApiClient(siteDb);
        const response = await apiClient.files.list()
        const responseObj = await check200JsonResponse(response);
        
        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        siteDb.db.transaction(function () {
            siteDb.files.server.deleteAll();
            for (const f of responseObj as ServerFileRow[]) {
                siteDb.files.server.upsertFile(f);
            }
        })(null);

        console.log('server', responseObj);
    }
});


mainCmd.command('diff')
.description('Compare local files to server files. (performs local reindex)')
.action(async (_options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'));
    const siteMap = new SiteMap(sitePath);
    await reIndexSiteMap(siteMap, siteDb);

    const { deletions, renames, uploads } = siteDb.files.compareLocalToServer();

    for (const item of deletions) {
        console.log('delete', item.urlPath);
    }
    for (const item of renames) {
        console.log('rename', item.server.urlPath, item.local.urlPath);
    }
    for (const item of uploads) {
        console.log('upload', item.urlPath);
    }
});


mainCmd.command('publish')
.description('Sync files to server. (Local reindex, diff, then upload/delete/rename)')
.action(async (_options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'));
    const siteMap = new SiteMap(sitePath);
    
    console.log('reindexing...');
    await reIndexSiteMap(siteMap, siteDb);

    console.log('comparing...');
    const apiClient = tryGetApiClient(siteDb);
    
    const { deletions, renames, uploads } = siteDb.files.compareLocalToServer();

    {
        console.log('deletions... ' + deletions.length.toString());
        const deleteList = deletions.map(x => x.urlPath);
        const response = await apiClient.files.delete(deleteList.join('\n'));
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        siteDb.files.server.deleteList(...deleteList);
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

        siteDb.files.server.renameList(renameList);
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

            siteDb.files.server.upsertFile(item);
        }
    }
});


mainCmd.command('getpayments')
.description('Download invoices from server')
.action(async (_options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'));
    const apiClient = tryGetApiClient(siteDb);

    let deleteList:string[] = [];

    while (true) {
        
        const response = await apiClient.invoices.transfer(deleteList.join('\n'), true);
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            break;
        }

        deleteList = [];

        const invoices = responseObj as InvoiceRow[];

        if (invoices.length === 0) {
            break;
        }
        
        siteDb.db.transaction(function () {
            for (const invoice of invoices) {
                siteDb.invoices.addInvoice(invoice);
                deleteList.push(invoice.ref);
            }
        })(null);
    }
});

////
////
////
////

const configCmd = mainCmd.command('config')
.addOption(configOptions.siteUrl)
.addOption(configOptions.authKey)
.option('--no-siteUrl', 'remove siteUrl config')
.option('--no-authKey', 'remove authKey config')
.description('set configuration options')
.action((options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'));

    for (const name in ['authKey','siteUrl']) {
        const key = '$.config.'+name;

        if (options[name]) {
            siteDb.meta.setValue(key, options[name]||null);
        }

        if (options[name] === false) {
            siteDb.meta.removeValue(key);
        }
    }
});

configCmd.command('show')
.option('-n, --names <names...>', 'specify names, or dont to show all')
.description('show config from db')
.action((options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'))
    
    console.log('config: '+path.join(sitePath, 'sweb.db'))
    
    const config = siteDb.getConfig();
    
    for(const [name,value] of Object.entries(config)) {
        if (options.names === undefined || options.names?.includes(name)) {
            console.log('  '+name,'=',value);
        }
    }
});

////

mainCmd.command('hdkey')
.option('--random', 'generate random key (seed will be printed)')
.option('--passphrase <passphrase>', 'passphrase for generated bitcoin seed')
.option('--xprv <xprv>', 'Bip32 Private Key xprv... ', validateXprv)
.action((options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    const siteDb = tryOpenDb(path.join(sitePath, 'sweb.db'));

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
        siteDb.meta.setValue('$.hdkeys.'+xprv.toPublic().toString(), xprv.toString());
        Deno.writeTextFileSync(path.join(sitePath,'xpub.txt'), xprv.toPublic().toString());
    }
});


const paywallsCmd = mainCmd.command('paywalls');
paywallsCmd.command('add')
.description('add paywall')
.argument('<pattern>', 'pattern')
.argument('<amount>', 'payment amount (SATs)')
.argument('[description]', 'reason for payment etc')
.argument('[address]', 'address or paymail')
.action((pattern, amount, description, address, _options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    
    const output = PaywallFile.ObjectToPaywallOutput({ amount, description, address });
    
    if (output.amount < 0) {
        throw new Error('invalid amount, must be integer > 0')
    }

    const jsonString = Deno.readTextFileSync(sitePath.filePath('paywalls.json'))
    const paywallFile = PaywallFile.fromJSON(jsonString);
    const spec = paywallFile.getPaywall(pattern);
    
    if (spec === undefined) {
        if (output.amount > 0) {
            paywallFile.addPaywall(pattern, { outputs: [ output ] });
        }
    } else {
        if (output.amount > 0) {
            spec.outputs = spec.outputs || [];
            spec.outputs.push(output);
        }
    }
    
    Deno.writeTextFileSync(sitePath.filePath('paywalls.json'), JSON.stringify(paywallFile, null, 2));
});

paywallsCmd.command('delete')
.description('delete paywall')
.argument('<pattern>', 'pattern')
.argument('<outputNum>', 'output number or `a` to remove all ')
.action((pattern, outputNum, _options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    const jsonString = Deno.readTextFileSync(sitePath.filePath('paywalls.json'))
    const paywallFile = PaywallFile.fromJSON(jsonString);

    const spec = paywallFile.getPaywall(pattern);

    if (spec && spec.outputs) {
        if (outputNum === 'a'){
            delete spec.outputs;
        } else {
            const outputNumInt = parseInt(outputNum);

            if (outputNumInt > 0 && outputNumInt <= spec.outputs.length) {
                spec.outputs.splice(outputNum-1, 1)
            }

            if (spec.outputs.length === 0) {
                delete spec.outputs;
            }
        }
    }

    Deno.writeTextFileSync(sitePath.filePath('paywalls.json'), JSON.stringify(paywallFile, null, 2));
});


paywallsCmd.command('show')
.action((_options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    const jsonString = Deno.readTextFileSync(sitePath.filePath('paywalls.json'))
    const paywallFile = PaywallFile.fromJSON(jsonString);

    console.log('paywalls: ');
    for (const [ pattern, spec ] of Object.entries(paywallFile.toJSON())) {
        console.log('  '+pattern);
        for (const [id,output] of spec.outputs.entries()) {
            console.log('    '+(id+1)+': ', output.amount, output.description, output.address);
        }
    }
});

////

