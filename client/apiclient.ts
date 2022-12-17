import * as path from "/deps/std/path/mod.ts";
import * as mime from "/deps/std/media_types/mod.ts";
import { bufferToHex } from "/deps/hextools/mod.ts";

import { trimstr } from "/trimstring.ts";

interface ApiClientSendOptions {
    onProgressFn?:() => void
    progressInterval?:number
    abortSignal?:AbortSignal
}

class ApiClientBase {

    urlPrefix:string
    authKey:string

    constructor (urlPrefix:string, authKey:string) {
        this.urlPrefix = trimstr(urlPrefix, { suffix: '/' });
        this.authKey = authKey;
    }

    async postFormData (urlPath:string, args:Record<string, string|Blob> = {}, options:ApiClientSendOptions={}) {
        
        const destUrl = new URL(this.urlPrefix);
        destUrl.pathname = urlPath;
        
        const formData = new FormData();
        
        for (const [key, arg] of Object.entries(args)) {
            if (arg !== undefined && arg !== null) {
                formData.append(key, arg);
            }
        }

        const res = await fetch(destUrl, { 
            signal: options.abortSignal, 
            headers: { 'x-authkey': this.authKey },
            method: 'POST', 
            body: formData
        });
        
        return await res.json();
    }
}


class FilesApiClient {
    
    client:ApiClientBase

    constructor (client:ApiClientBase) {
        this.client = client;
    }

    info (urlPath:string) {
        return this.client.postFormData('/.api/files/info', { urlPath });
    }

    async upload (urlPath:string, storagePath:string, hash?:string, size?:number, mimeType?:string, onProgressFn = () => {}) {

        const blob = await Deno.readFile(storagePath);
        
        if (hash === undefined) {
            hash = bufferToHex(await crypto.subtle.digest('SHA-256', blob));
        }

        if (size === undefined) {
            size = blob.length;
        }

        if (mimeType === undefined) {
            mimeType = mime.contentType(path.extname(urlPath)) || 'application/octet-stream';
        }

        const filedata = new File([blob], path.basename(urlPath));

        return await this.client.postFormData('/.api/files/upload', { 
            urlPath,
            hash: hash!,  
            size: size!.toString(), 
            mimeType: mimeType!, 
            filedata 
        }, { onProgressFn });
    }

    rename (renameList:string) {
        return this.client.postFormData('/.api/files/rename', { rename: renameList });
    }

    delete (deleteList:string) {
        return this.client.postFormData('/.api/files/delete', { delete: deleteList });
    }

    list (search:string, offset:number) {
        return this.client.postFormData('/.api/files/list', { search, offset: offset.toString() });
    }
}

class PaywallsApiClient {
    
    client:ApiClientBase

    constructor (client:ApiClientBase) {
        this.client = client;
    }

    set (paywallsJSON:string) {
        return this.client.postFormData('/.api/paywalls/set', { paywalls: paywallsJSON });
    }

    get () {
        return this.client.postFormData('/.api/paywalls/get');
    }
}

class InvoicesApiClient {
    client:ApiClientBase

    constructor (client:ApiClientBase) {
        this.client = client;
    }

    transfer (deleteList:string) {
        return this.client.postFormData('/.api/invoices/transfer', { delete: deleteList });
    }
}

export class ApiClient {

    paywalls:PaywallsApiClient
    invoices:InvoicesApiClient
    files:FilesApiClient
    client:ApiClientBase
  
    constructor (urlPrefix:string, authKey:string) {
        this.client = new ApiClientBase(urlPrefix, authKey);
        this.files = new FilesApiClient(this.client);
        this.invoices = new InvoicesApiClient(this.client);
        this.paywalls = new PaywallsApiClient(this.client);
    }

    status () {
        return this.client.postFormData('/.api/status');
    }
    
}