import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule from "/lib/database/metadb.ts";
import type { MetaDbApi } from "/lib/database/metadb.ts";

export interface CountersDbApi extends MetaDbApi{
    db:Database,
    nextValue (name:string) : number
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    db.prepare(`create table counters (name text primary key, counter int) without rowid`).run();
}

export function getApi (db:Database) : CountersDbApi {
    const psIncrement = db.prepare(`
        insert into counters (name, counter) values (?, 0)
        on conflict (name) do update set counter = counter + 1
        returning counter;`
    );
    return {
        ...MetaDbModule.getApi(db),
        nextValue (name) {
            return psIncrement.all(name)[0]['counter'];
        }
    }
}

export default { initSchema, getApi }