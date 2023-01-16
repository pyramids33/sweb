import { Database } from "/deps/sqlite3/mod.ts";

export interface FilesDbApi {
    db:Database,
    local:LocatedFilesDbApi,
    server:LocatedFilesDbApi,
    compareLocalToServer(): CompareFilesResult
}

export interface LocatedFilesDbApi {
    db:Database
    upsertFile (row:{
        urlPath:string,
        hash:string,
        size:number,
        storagePath?:string,
        mimeType:string,
        mtime?:number
    }) : number
    deleteFile (urlPath:string) : FileRow|undefined
    deleteList (...urlPaths:string[]):void
    rename (oldPath:string, newPath:string) : number
    renameList (list:[string,string][]):void
    listFiles () : FileRow[]
    fileRow (urlPath:string) : FileRow | undefined
    deleteAll () : number
}

export interface FileRow extends Record<string, unknown> {
    urlPath:string
    hash:string
    size:number
    storagePath:string
    mimeType:string
    mtime:number
}

interface CompareFilesResult {
    matches: { local:FileRow, server:FileRow }[]
    renames: { local:FileRow, server:FileRow }[]
    uploads: FileRow[],
    deletions: FileRow[]
}

export function compareLocalToServer (localFiles:FileRow[], serverFiles:FileRow[]):CompareFilesResult {
    
    const matches = [];
    const renames = [];
    const uploads = [];

    let jStart = 0;

    for (let i = 0; i < localFiles.length; i++) {
        
        const local = localFiles[i];
        let matched = false;

        for (let j = jStart; j < serverFiles.length; j++) {

            const server = serverFiles[j];

            if (local.urlPath === server.urlPath && local.hash === server.hash) {
                
                matches.push({ local, server });
                matched = true;

            } else if (local.urlPath !== server.urlPath && local.hash === server.hash) {
                
                renames.push({ local, server });
                matched = true;
            
            } else if (local.urlPath === server.urlPath && local.hash !== server.hash) {

                uploads.push(local);
                matched = true;

            }

            if (matched) {
                // Replace this matched item with an unmatched item from the start of the array.
                // Therefore, all the unmatched items are between jStart and serverFiles.length
                serverFiles[j] = serverFiles[jStart];
                jStart += 1;
                break;
            }
        }

        if (!matched) {
            uploads.push(local);
        }

    }

    const deletions = serverFiles.slice(jStart);

    return { matches, renames, uploads, deletions };
}


function getLocatedFilesDbApi (db:Database, location:string) : LocatedFilesDbApi {

    const psUpsertFile = db.prepare(`
        insert into files (location, urlPath, hash, size, storagePath, mimeType, mtime) 
        values (:location, :urlPath, :hash, :size, :storagePath, :mimeType, :mtime) 
        on conflict (location,urlPath) do update 
        set hash = :hash, size = :size, storagePath = :storagePath, mimeType = :mimeType, mtime = :mtime; `);

    const psListFiles = db.prepare(`
        select urlPath, hash, size, storagePath, mimeType, mtime 
        from files 
        where location = ? order by urlPath`);

    const psFileByUrlPath = db.prepare(`
        select urlPath, hash, size, storagePath, mimeType, mtime 
        from files 
        where location = ? and urlPath = ?`);

    // need SQLITE_ENABLE_UPDATE_DELETE_LIMIT for limit
    const psDeleteFileByUrlPath = db.prepare('delete from files where location = ? and urlPath = ? returning *'); 

    const psRenameDir = db.prepare(`
        update files set 
            urlPath = :newPath || substring(urlPath, length(:oldPath)+1) 
        where location = :location and urlPath like :oldPath `);

    const psRenameFile = db.prepare(`update files set urlPath = :newPath where location = :location and urlPath = :oldPath`)

    const psDeleteAll = db.prepare('delete from files where location = ? ');

    return {
        db,
        upsertFile ({ urlPath, hash, size, storagePath=null, mimeType, mtime=0 }) {
            return psUpsertFile.run({ location, urlPath, hash, size, storagePath, mimeType, mtime });
        },

        deleteFile (urlPath) {
            return psDeleteFileByUrlPath.all<FileRow>(location, urlPath)?.[0];
        },

        deleteList (...urlPaths) {
            db.transaction(function () {
                for (const urlPath of urlPaths) {
                    psDeleteFileByUrlPath.all(location, urlPath);
                }
            })(null)

        },

        deleteAll () {
            return psDeleteAll.run(location);
        },

        rename (oldPath, newPath) {
            if (oldPath.startsWith('/') && newPath.startsWith('/')) {
                if (oldPath.endsWith('/') && newPath.endsWith('/')) {
                    return psRenameDir.run({ location, oldPath, newPath });
                } else {
                    return psRenameFile.run({ location, oldPath, newPath });
                }
            } else {
                // throw error
            }
            return 0;
        },

        renameList (list) {
            db.transaction<LocatedFilesDbApi>(function (_this) {
                for (const [oldPath,newPath] of list) {
                    _this.rename(oldPath, newPath);
                }
            })(this)
        },

        listFiles () {
            return psListFiles.all(location);
        },

        fileRow (urlPath) {
            return psFileByUrlPath.get(location, urlPath);
        }
    }
}

function initSchema (db:Database) {
    db.prepare(`
        create table files (
            location text, urlPath text, hash text, size int, mimeType text, storagePath text, mtime int,
            primary key(location,urlPath))
    `).run();
}



function getApi (db:Database) : FilesDbApi {
    return {
        db,
        local: getLocatedFilesDbApi(db, 'local'),
        server: getLocatedFilesDbApi(db, 'server'),
        compareLocalToServer: function () {
            const serverFiles = this.server.listFiles();
            const localFiles = this.local.listFiles();
            return compareLocalToServer(localFiles, serverFiles);
        }
    }
}

export default { initSchema, getApi }

