import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule from "./metadb.ts";
import type { MetaDbApi } from "./metadb.ts";

import ConfigDbModule from "./configdb.ts";
import type { ConfigDbApi } from "./configdb.ts";

import FilesDbModule from "./filesdb.ts";
import type { FilesDbApi } from "./filesdb.ts";

export interface SiteDbApi {
    db:Database,
    meta:MetaDbApi, 
    config:ConfigDbApi, 
    files:FilesDbApi 
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    FilesDbModule.initSchema(db);
    ConfigDbModule.initSchema(db);
}

export function getApi (db:Database) : SiteDbApi {
    return {
        db,
        meta: MetaDbModule.getApi(db),
        config: ConfigDbModule.getApi(db),
        files: FilesDbModule.getApi(db)
    }
}

export default { initSchema, getApi }