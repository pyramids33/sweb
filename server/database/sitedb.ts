import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule, { MetaDbApi } from "/lib/database/metadb.ts";
import FilesDbModule, { FilesDbApi } from "./filesdb.ts";
import InvoicesDbModule, { InvoicesDbApi } from "./invoicesdb.ts";


export interface SiteDbApi {
    db:Database
    meta:MetaDbApi
    files:FilesDbApi 
    invoices:InvoicesDbApi
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    FilesDbModule.initSchema(db);
    InvoicesDbModule.initSchema(db);
}

export function getApi (db:Database) : SiteDbApi {
    
    return {
        db,
        meta: MetaDbModule.getApi(db),
        files: FilesDbModule.getApi(db),
        invoices: InvoicesDbModule.getApi(db)
    }
}

export default { initSchema, getApi }


