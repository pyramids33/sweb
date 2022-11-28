import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule from "./metadb.ts";
import type { MetaDbApi } from "./metadb.ts";

export interface SessionDbApi {
    db:Database,
    meta:MetaDbApi, 
    setCheckIn (date:number):number 
    getCheckIn () : number
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    db.prepare(`create table checkin (date int);`).run();
    db.prepare('insert into checkin (rowid,date) values (1,?)').run(Date.now());
}

export function getApi (db:Database) : SessionDbApi {
    const psSetCheckIn = db.prepare(`update checkin set date = ? where rowid = 1`);
    const psGetCheckIn = db.prepare('select date from checkin where rowid = 1');

    return {
        db,
        meta: MetaDbModule.getApi(db),
        setCheckIn (date) {
            return psSetCheckIn.run(date);
        },
        getCheckIn () {
            return psGetCheckIn.get<{date:number}>()!.date;
        }
    }
}

export default { initSchema, getApi }
