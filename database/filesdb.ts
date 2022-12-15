import { Database } from "/deps/sqlite3/mod.ts";
import * as path from "/deps/std/path/mod.ts";

import * as coalesce from "/coalesce.ts";

function sqlite3LikePipeEscape (theString:string) : string {
    return theString.replaceAll('|','||').replaceAll('%', '|%').replaceAll('_', '|_')
}

export interface FilesDbApi {
    db:Database,
    upsertFile (f:FileRow) : number
    deleteFile (urlPath:string) : FileRow|undefined
    rename (oldPath:string, newPath:string) : number
    listFiles (search?:string, limit?:number, offset?:number) : FileRow[]
    dirInfo (urlPath:string) : DirInfoResult
    fileRow (urlPath:string) : FileRow | undefined
    deleteAll () : number
}

export interface FileRow extends Record<string, unknown> {
    urlPath:string
    hash:string
    size:number
    storagePath:string
    mimeType:string
}

export interface DirListRow extends Record<string, unknown>  {
    urlPath:string
    name:string
    size:number
    hash?:string
    count:number
    storagePath?:string
    mimeType?:string
}

export interface DirInfoResult extends Record<string, unknown> {
    urlPath:string
    name:string
    size?:number
    hash?:string
    count:number
    totalSize:number
    storagePath?:string
    mimeType?:string
    files: DirListRow[]
}

export function initSchema (db:Database) {
    db.prepare(`
        create table files (
            urlPath text, hash text, size int, mimeType text, storagePath text, 
            primary key(urlPath))
    `).run();
}

export function getApi (db:Database) : FilesDbApi {

    const psUpsertFile = db.prepare(`
        insert into files (urlPath, hash, size, storagePath, mimeType) 
        values (:urlPath, :hash, :size, :storagePath, :mimeType) 
        on conflict (urlPath) do update 
        set hash = :hash, size = :size, storagePath = :storagePath, mimeType = :mimeType; `);

    //const psListFiles = db.prepare(`select urlPath, hash, size, storagePath, mimeType from files order by urlPath`);

    const psDirList = db.prepare(`
        select name, urlPath, sum(size) as size, hash, mimeType, storagePath, sum(nfiles) as "count"
        from (
            select 
                urlPath
                case when slashPos > 0 then substr(suffix, 0, slashPos+1) else suffix end as name, 
                size,
                case when slashPos > 0 then null else hash end as hash,
                mimeType,
                case when slashPos > 0 then null else storagePath end as storagePath,
                nfiles
            from ( 
                select urlPath, size, hash, mimeType, storagePath,
                    substr(urlPath, length(:urlPath)) as suffix, 
                    instr(substr(urlPath, length(:urlPath)),'/') as slashPos,
                    1 as nfiles
                from files 
                where urlPath like :search escape '|'
            ) a
        ) b
        group by urlPath, hash, storagePath
        order by case when hash is null then 0 else 1 end, name;
    `);

    const psFileByUrlPath = db.prepare('select urlPath, hash, size, storagePath, mimeType from files where urlPath = ?');
    
    // need SQLITE_ENABLE_UPDATE_DELETE_LIMIT for limit
    const psDeleteFileByUrlPath = db.prepare('delete from files where urlPath = ? returning *'); 

    const psRenameDir = db.prepare(`
        update files set 
            urlPath = :newPath || substring(urlPath, length(:oldPath)+1) 
        where urlPath like :oldPath `);

    const psRenameFile = db.prepare(`update files set urlPath = :newPath where urlPath = :oldPath`)

    const psDeleteAll = db.prepare('delete from files');

    return {
        db,
        upsertFile ({ urlPath, hash, size, storagePath, mimeType }) {
            return psUpsertFile.run({ urlPath, hash, size, storagePath, mimeType });
        },

        deleteFile (urlPath) {
            return psDeleteFileByUrlPath.get<FileRow>(urlPath);
        },

        rename (oldPath, newPath) {
            if (oldPath.startsWith('/') && newPath.startsWith('/')) {
                if (oldPath.endsWith('/') && newPath.endsWith('/')) {
                    return psRenameDir.run({ oldPath, newPath });
                } else {
                    return psRenameFile.run({ oldPath, newPath });
                }
            } else {
                // throw error
            }
            return 0;
        },

        listFiles (search?:string, limit?:number, offset?:number) {
            limit = coalesce.safeInt(limit, undefined, 10);
            offset = coalesce.safeInt(offset, undefined, 10);

            let qstr = ' select urlPath, hash, size, mimeType, storagePath from files ';
            const args = [];

            if (search) {
                qstr += ` where urlPath like ? escape '|' `;
                args.push(sqlite3LikePipeEscape(search) + '%');
            }

            qstr += ` order by urlPath `;

            if (limit||offset) {
                qstr += ` limit ${limit} offset ${offset} `;
            }

            return db.prepare(qstr).all(...args);
        },

        dirInfo (urlPath) {
            const fileRow:FileRow|undefined = psFileByUrlPath.get(urlPath);

            urlPath = urlPath.endsWith('/') ? urlPath : urlPath + '/';

            const files:DirListRow[] = psDirList.all({ urlPath, search: sqlite3LikePipeEscape(urlPath) + '_%' });   
            
            return { 
                name: path.basename(urlPath),
                urlPath, 
                size: fileRow?.size||0,
                totalSize: files.reduce((p,c) => p + c.size, 0),
                count: files.reduce((p,c) => p + c.count, 0),
                mimeType: fileRow?.mimeType,
                storagePath: fileRow?.storagePath,
                hash: fileRow?.hash,
                files 
            };
        },

        fileRow (urlPath) {
            return psFileByUrlPath.get(urlPath);
        },

        deleteAll () {
            return psDeleteAll.run();
        }
    }
}

export default { initSchema, getApi }



