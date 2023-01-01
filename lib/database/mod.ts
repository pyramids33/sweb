import { Database, DatabaseOpenOptions } from "/deps/sqlite3/mod.ts";

export type DbInitSchemaFn = (db:Database) => void;
export type DbGetApiFn<A> = (db:Database) => A;
export type DbModule<A> = {
    initSchema:DbInitSchemaFn, 
    getApi:DbGetApiFn<A>
};

export function sqlite3LikePipeEscape (theString:string) : string {
    return theString.replaceAll('|','||').replaceAll('%', '|%').replaceAll('_', '|_')
}

export function openDb <A> (    
    dbModule:DbModule<A>,
    filename:string|URL, 
    options?:DatabaseOpenOptions, 
) {    
    options = options ?? {};
    options.int64 = true;
    // ! readonly mode produces SQLite API Misuse Error

    const db = new Database(filename, options);
    
    db.exec('pragma journal_mode = WAL');
    
    if (options.create !== false && options.readonly !== true) {
        db.transaction(function () {
            try {
                dbModule.initSchema(db);
            } catch (error) {
                if (/\ already exists/.test(error.message)) {
                    // ignore
                } else {
                    throw error;
                }
            }
        })(null);
    }

    return dbModule.getApi(db);
}