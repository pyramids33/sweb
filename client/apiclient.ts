import * as path from "/deps/std/path/mod.ts";
import * as mime from "/deps/std/media_types/mod.ts";

import { trims } from "/lib/trims.ts";
import { sha256hex } from "/lib/hash.ts";

export interface ApiClientSendOptions {
    onProgressFn?:() => void
    progressInterval?:number
}

class ApiClientBase {

    urlPrefix:string
    authKey:string
    abortSignal?:AbortSignal

    constructor (urlPrefix:string, authKey:string, abortSignal?:AbortSignal) {
        this.urlPrefix = trims(urlPrefix, { suffix: '/' });
        this.authKey = authKey;
        this.abortSignal = abortSignal;
    }

    async postFormData (urlPath:string, args:Record<string, string|Blob|undefined> = {}, _options:ApiClientSendOptions={}) {
        const destUrl = new URL(this.urlPrefix);
        destUrl.pathname = urlPath;
        
        const formData = new FormData();
        
        for (const [key, arg] of Object.entries(args)) {
            if (arg !== undefined && arg !== null) {
                formData.append(key, arg);
            }
        }

        const res = await fetch(destUrl, { 
            signal: this.abortSignal, 
            headers: { 'x-authkey': this.authKey },
            method: 'POST', 
            body: formData
        });

        return res;
    }

}




export class ApiClient {

    client:ApiClientBase
  
    constructor (urlPrefix:string, authKey:string, abortSignal?:AbortSignal) {
        this.client = new ApiClientBase(urlPrefix, authKey, abortSignal);
    }

    activateAuthKey () {
        return this.client.postFormData('/.api/activate-authkey');
    }  

    deleteFiles (deleteList:string) {
        return this.client.postFormData('/.api/delete-files', { delete: deleteList });
    }

    downloadFile (urlPath:string) {
        return this.client.postFormData('/.api/download-file', { urlPath });
    }

    getFileInfo (urlPath:string) {
        return this.client.postFormData('/.api/get-fileinfo', { urlPath });
    }

    searchFiles (search?:string, offset?:number) {
        return this.client.postFormData('/.api/search-files', { search, offset: offset?.toString() });
    }

    getPayments (deleteList:string, doSend=true) {
        return this.client.postFormData('/.api/get-payments', { delete: deleteList, doSend: doSend ? '1' : '0' });
    }  

    getStatus () {
        return this.client.postFormData('/.api/get-status');
    }

    renameFiles (renameList:string) {
        return this.client.postFormData('/.api/rename-files', { rename: renameList });
    }

    async uploadFile (cwdRelativePath:string, urlPath:string, hash?:string, size?:number, mimeType?:string, onProgressFn = () => {}) {

        const blob = await Deno.readFile(cwdRelativePath);
        
        if (hash === undefined) {
            hash = sha256hex(blob);
        }

        if (size === undefined) {
            size = blob.length;
        }

        if (mimeType === undefined) {
            mimeType = mime.contentType(path.extname(urlPath)) || 'application/octet-stream';
        }

        const filedata = new File([blob], path.basename(urlPath));

        return await this.client.postFormData('/.api/upload-file', { 
            urlPath,
            hash: hash,  
            size: size.toString(), 
            mimeType: mimeType, 
            filedata 
        }, { onProgressFn });
    }

}