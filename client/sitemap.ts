import { walk, WalkOptions } from "/deps/std/fs/mod.ts"
import * as mime from "/deps/std/media_types/mod.ts";
import * as path from "/deps/std/path/mod.ts";

import { tryStat } from "/lib/trystat.ts";
import * as JSONFile from "/lib/jsonfile.ts"
import { trims } from "/lib/trims.ts";


export interface SwebVars {
    filename?:string
    mimeType?:string
}

export interface SiteMapEntry {
    dbRelativePath:string
    urlPath:string
    storagePath:string
    isDirectory:boolean
    mimeType:string
}

export function urlPathToDbRelativeFilePath (urlPath:string) {
    urlPath = '/' + trims(urlPath, { both: '/' })
    return path.fromFileUrl(new URL('file://'+urlPath))
}

export class SiteMap {

    sitePath:string
    ignoreList:string[]

    constructor (sitePath:string, ignoreList:string[]=[]) {
        this.sitePath = sitePath;
        this.ignoreList = ['sweb.db','sweb.db-shm','sweb.db-wal','sweb.json', ...ignoreList];
    }

    async* walk (dbRelativePath='', walkOptions?:WalkOptions) {
        const walkPath = path.join(this.sitePath, dbRelativePath);

        for await (const entry of walk(walkPath, walkOptions)) {
            const dbRelativePath = path.relative(this.sitePath, entry.path);
            const info = await this.fileInfo(dbRelativePath);
    
            if (info) {
                yield info;
            }
        }
    }
    
    async* dirList (dbRelativePath='') {
        for await (const entry of this.walk(dbRelativePath, { maxDepth: 1 })) {
            if (entry.dbRelativePath !== '') {
                yield entry;
            } 
        }
    }

    async fileInfo (dbRelativePath:string) : Promise<SiteMapEntry|undefined> {

        const urlPath = path.toFileUrl('/'+dbRelativePath).pathname;
        const basename = path.basename(dbRelativePath);

        if (this.ignoreList.includes(dbRelativePath) || basename === 'sweb.json') {
            return undefined;
        }

        const entryPath = path.join(this.sitePath, dbRelativePath); // current working dir relative
        const entryStat = await tryStat(path.join(this.sitePath, dbRelativePath));

        if (entryStat && entryStat.isFile) {
            const swebVars = await JSONFile.tryRead<SwebVars>(path.join(entryPath, '..', 'sweb.json'), undefined);
            
            // this file maps to a directory url--ignore
            if (basename === swebVars?.filename || basename === 'default.html') {
                return undefined;
            }

            const mimeType = mime.contentType(path.extname(dbRelativePath))||'application/octet-stream';

            return {
                dbRelativePath,
                urlPath,
                storagePath: dbRelativePath,
                isDirectory: false,
                mimeType
            }
        }

        if (entryStat && entryStat.isDirectory) {
            const swebVars = await JSONFile.tryRead<SwebVars>(path.join(entryPath, 'sweb.json'), undefined);
            
            if (swebVars?.filename) {
                const storagePath = path.join(dbRelativePath, path.basename(swebVars.filename));
                const mimeType = swebVars?.mimeType || mime.contentType(path.extname(swebVars.filename)) || 'application/octet-stream';
                return {
                    dbRelativePath,
                    urlPath: trims(urlPath, { suffix: '/' }) + '/',
                    storagePath,
                    isDirectory: true,
                    mimeType
                }
            }

            // default files
            // lookup default.*
            // if more than one, ignore and use sweb.json

            const defaultHtmlStat = await tryStat(path.join(entryPath, 'default.html'));

            if (defaultHtmlStat) {
                const storagePath = path.join(dbRelativePath, 'default.html');
                const mimeType = mime.contentType('.html');
                return {
                    dbRelativePath,
                    urlPath: trims(urlPath, { suffix: '/' }) + '/',
                    storagePath,
                    isDirectory: true,
                    mimeType
                }
            }

            return undefined; // no entry for that path
        }
    }
}

