import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";
import { Buffer } from "/deps/std/node/buffer.ts";
import bsv from "npm:bsv";

import SwebDbModule, { SwebDbApi } from "/client/database/swebdb.ts";
import { ApiClient } from "/client/apiclient.ts";

import { openDb } from "/lib/database/mod.ts";
import { PaywallFile } from "/lib/paywallfile.ts";

export interface ServerFileRow {
    urlPath:string
    hash:string
    size:number
    mimeType:string
}

export function validateAuthKey (value:string) {
    if (value === 'r') {
        value = crypto.getRandomValues(Buffer.alloc(32)).toString('hex');
    } else if (value && !/^(?:[a-f0-9]{2}){5,32}$/.test(value)) {
        throw new commander.InvalidArgumentError('Not a hex string 10-64 chars');
    }
    return value;
}

export function validateUrl (value:string) : string {
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

export function validateXprv (value:string) : bsv.Bip32 {
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

export function validateFormat (value:string) {
    if (['text','json'].includes(value)) {
        return value;
    }
    throw new commander.InvalidOptionArgumentError('valid option is text, json')
}

export function validateAddress (value:string) {
    try {
        return bsv.Address.fromString(value)
    } catch {
        throw new commander.InvalidOptionArgumentError('invalid address');
    }
}

export function tryOpenDb (sitePath:string) {
    const dbPath = path.join(sitePath, 'sweb.db');
    try {

        return openDb(SwebDbModule, dbPath, { create: false });
    } catch (error) {
        if (error.message === '14: unable to open database file') {
            console.error('Cannot open database: ' + dbPath);
            Deno.exit(1);
        }
        throw error;
    }
}

export function tryGetApiClient (swebDb:SwebDbApi, abortSignal?:AbortSignal) {
    const { siteUrl, authKey } = swebDb.getConfig();
    
    if (siteUrl === undefined) {
        console.error('Missing siteUrl. (run config command)');
        Deno.exit(1);
    }

    try {
        new URL(siteUrl!);
    } catch {
        console.error('Invalid siteUrl. (run config command)');
        Deno.exit(1);
    }

    if (authKey === undefined) {
        console.error('Missing authKey. (run config command)');
        Deno.exit(1);
    }
    return new ApiClient(siteUrl, authKey, abortSignal);
}

export function getPaywallFile (sitePath:string) {
    let paywallFile;
    try {
        const jsonString = Deno.readTextFileSync(path.join(sitePath,'paywalls.json'));
        paywallFile = PaywallFile.fromJSON(jsonString);
    } catch {
        paywallFile = new PaywallFile();
    }
    return paywallFile; 
}

export async function check200JsonResponse (response:Response) {
    // check response is status 200 with valid JSON, return
    // return response data as object
    let responseObj; 

    try {
        responseObj = await response.json();
    } catch {
        console.error('Error: invalid json response');
        Deno.exit(1);
    }

    if (!response.ok) {
        console.error('Error: ' + response.status.toString() + ' ' + response.statusText, responseObj);
        Deno.exit(1);
    }
    
    return responseObj;
}

// function prettyFiles (obj) {
//     // pretty print for getfiles command
//     let out = Object.keys(obj.files)
//         .sort()
//         .map(x => { return { ...obj.files[x], urlPath: x }});
//     console.table(out, ['urlPath','mimeType','size','hash']);
// }

export const configOptions = {
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

export const sitePathOption = new commander.Option('-s --sitePath <sitePath>', 'path to local site root')
.default('.', 'current working dir')
