import { Database } from "/deps/sqlite3/mod.ts";

export interface FilesDbApi {
    db:Database,
    setFile (f:FileRow) : number,
    deleteFile (urlPath:string) : FileRow|undefined,
    rename (oldPath:string, newPath:string) : number,
    listFiles () : FileRow[],
    fileByUrlPath (urlPath:string) : FileRow | undefined,
    deleteAll () : number
}

export interface FileRow extends Record<string, unknown> {
    urlPath:string, 
    hash:string, 
    size:number, 
    storagePath:string, 
    mimeType:string
}

export function initSchema (db:Database) {
    db.prepare(`
        create table files (
            urlPath text, hash text, size int, mimeType text, storagePath text, 
            primary key(urlPath))
    `).run();
}

export function getApi (db:Database) : FilesDbApi {

    const psSetFile = db.prepare(`
        insert into files (urlPath, hash, size, storagePath, mimeType) 
        values (:urlPath, :hash, :size, :storagePath, :mimeType) 
        on conflict (urlPath) do update 
        set hash = :hash, size = :size, storagePath = :storagePath, mimeType = :mimeType; `);

    const psListFiles = db.prepare(`select urlPath, hash, size, storagePath, mimeType from files order by urlPath`);
    
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
        setFile ({ urlPath, hash, size, storagePath, mimeType }) {
            return psSetFile.run({ urlPath, hash, size, storagePath, mimeType });
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

        listFiles () {
            return psListFiles.all<FileRow>();
        },

        fileByUrlPath (urlPath) {
            return psFileByUrlPath.get(urlPath);
        },

        deleteAll () {
            return psDeleteAll.run();
        }
    }
}

export default { initSchema, getApi }



