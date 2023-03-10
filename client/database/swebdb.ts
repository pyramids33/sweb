import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule, { MetaDbApi } from "/lib/database/metadb.ts";
import FilesDbModule, { FilesDbApi } from "./filesdb.ts";
import InvoicesDbModule, { InvoicesDbApi } from "./invoicesdb.ts";
import InvoiceOutputsDbModule, { InvoiceOutputsDbApi } from "./invoutputsdb.ts";

export interface Config {
    authKey?:string
    siteUrl?:string
}

export interface SwebDbApi {
    db:Database
    meta:MetaDbApi
    files:FilesDbApi 
    invoices:InvoicesDbApi
    outputs:InvoiceOutputsDbApi
    getConfig(): Config
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    FilesDbModule.initSchema(db);
    InvoicesDbModule.initSchema(db);
    InvoiceOutputsDbModule.initSchema(db);
}

export function getApi (db:Database) : SwebDbApi {
    const metaApi = MetaDbModule.getApi(db);
    return {
        db,
        meta: metaApi,
        files: FilesDbModule.getApi(db),
        invoices: InvoicesDbModule.getApi(db),
        outputs: InvoiceOutputsDbModule.getApi(db),
        getConfig () {
            return this.meta.getValue('$.config') as Config
        }
    }
}

export default { initSchema, getApi }


