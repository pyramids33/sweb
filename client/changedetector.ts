import * as path from "/deps/std/path/mod.ts";

import { tryStat } from "/lib/trystat.ts";

import { SwebDbApi } from "./swebdb.ts";
import { FileRow } from "./filesdb.ts";
import { AsyncQueue } from "/lib/asyncqueue.ts";
import { hashFile } from "/lib/hash.ts";
import { SiteMap, SiteMapEntry, urlPathToDbRelativeFilePath } from "./sitemap.ts";


const NoOp = () => {};

export class ChangeDetector {

    siteMap:SiteMap
    swebDb:SwebDbApi
    upserts:FileRow[]
    deletions:string[]
    missing:SiteMapEntry[]

    constructor (siteMap:SiteMap, swebDb:SwebDbApi) {
        this.siteMap = siteMap;
        this.swebDb = swebDb;
        this.upserts = [];
        this.deletions = [];
        this.missing = [];
    }

    async detectChanges(onError:(error:unknown) => void = NoOp) {
        this.upserts = [];
        this.deletions = [];
        this.missing = [];

        const aq = new AsyncQueue(3);

        for await (const siteMapEntry of this.siteMap.walk()) {
            await aq.queue(this.#findModified(siteMapEntry).catch(onError));
        }
    
        for (const fileRow of this.swebDb.files.local.listFiles()) {
            await aq.queue(this.#findDeleted(fileRow).catch(onError));
        }    
        
        await aq.done();
    
        return { 
            missing: this.missing, 
            upserts: this.upserts, 
            deletions: this.deletions 
        }
    }

    async #findModified (entry:SiteMapEntry) {

        const entryPath = path.join(this.siteMap.sitePath, entry.storagePath); // current working dir relative
    
        const stat = await tryStat(entryPath);

        if (stat === undefined) {
            this.missing.push(entry);
            return;
        }

        if (!stat.isFile) {
            return;
        }

        const fileRow = this.swebDb.files.local.fileRow(entry.urlPath);

        const mtime = stat.mtime !== null ? new Date(stat.mtime).valueOf() : Date.now();

        if (fileRow === undefined || 
            fileRow.storagePath !== entry.storagePath ||
            fileRow.size !== stat.size || 
            fileRow.mtime !== mtime ||
            fileRow.mimeType !== entry.mimeType
        ) {
            const hash = await hashFile('sha256', entryPath, 'hex');

            this.upserts.push({ 
                urlPath: entry.urlPath, 
                hash, 
                size: stat.size, 
                mtime: mtime, 
                mimeType: entry.mimeType, 
                storagePath: entry.storagePath
            });
        }
    
        return;
    }

    async #findDeleted (fileRow:FileRow) {
        const dbRelativePath = urlPathToDbRelativeFilePath(fileRow.urlPath);
        const info = await this.siteMap.fileInfo(dbRelativePath);
        if (info === undefined) {
            this.deletions.push(fileRow.urlPath); 
        }
    }
}