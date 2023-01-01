import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule from "/lib/database/metadb.ts";
import type { MetaDbApi } from "/lib/database/metadb.ts";

import ClientFilesDbModule from "./clientfilesdb.ts";
import type { ClientFilesDbApi } from "./clientfilesdb.ts";

import InvoicesDbModule from "./invoicesdb.ts";
import type { InvoicesDbApi } from "./invoicesdb.ts";

export interface Config {
    authKey?:string
    siteUrl?:string
}

export interface ClientSiteDbApi {
    db:Database
    meta:MetaDbApi
    files:ClientFilesDbApi 
    invoices:InvoicesDbApi
    getConfig(): Config
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    ClientFilesDbModule.initSchema(db);
    InvoicesDbModule.initSchema(db);
}

export function getApi (db:Database) : ClientSiteDbApi {
    const metaApi = MetaDbModule.getApi(db);
    return {
        db,
        meta: metaApi,
        files: ClientFilesDbModule.getApi(db),
        invoices: InvoicesDbModule.getApi(db),
        getConfig () {
            return this.meta.getValue('$.config') as Config
        }
    }
}

export default { initSchema, getApi }


