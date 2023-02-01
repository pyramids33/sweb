
import * as path from '/deps/std/path/mod.ts';
import { trims } from '/lib/trims.ts';
import { FileRow } from '/server/database/filesdb.ts';
import { tryStat } from "/lib/trystat.ts";
import * as mime from "/deps/std/media_types/mod.ts";

export class PathMapper {

    mappings:{ urlPrefix:string, pathPrefix: string }[]

    constructor (mappings:{ urlPrefix:string, pathPrefix: string }[]) {
        this.mappings = mappings;
        for (const mapping of this.mappings) {
            mapping.urlPrefix = trims(mapping.urlPrefix, { suffix: '/' });
        }
    }

    async mapPath (requestPath:string) : Promise<FileRow | undefined> {
        for (const mapping of this.mappings) {
            const fileRow = await this.#mapPath(requestPath, mapping.urlPrefix, mapping.pathPrefix);
            
            if (fileRow) {
                return fileRow;
            }
        }
    }

    async #mapPath (requestPath:string, urlPrefix:string, pathPrefix:string) {
        
        if (!path.isAbsolute(pathPrefix)) {
            return undefined;
        }

        let storagePath;

        if (requestPath === urlPrefix) {
            storagePath = pathPrefix;
        } else if (requestPath.startsWith(urlPrefix + '/')) {
            storagePath = path.join(pathPrefix, path.fromFileUrl('file:///' + requestPath.slice(urlPrefix.length))); 
        } else {
            return undefined;
        }

        let stat = await tryStat(storagePath);

        if (stat === undefined) {
            return undefined;
        }

        if (stat.isDirectory && requestPath.endsWith('/')) {
            const storagePathDefault = path.join(storagePath, 'default.html')
            
            stat = await tryStat(storagePathDefault);
            
            if (stat?.isFile) {
                storagePath = storagePathDefault;
            }
        }
            
        if (stat?.isFile) {
            return {
                urlPath: requestPath,
                hash: '',
                size: stat.size,
                storagePath: storagePath,
                mimeType: mime.contentType(path.extname(storagePath))||''
            }
        }
        
    }
}