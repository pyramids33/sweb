import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule, { MetaDbApi } from "/lib/database/metadb.ts";
import InvoicesDbModule, { InvoicesDbApi } from "./invoicesdb.ts";

export interface SessionDbApi extends InvoicesDbApi {
    db:Database
    meta:MetaDbApi
    setCheckIn (date:number):number 
    getCheckIn () : number
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    db.prepare(`create table checkin (date int);`).run();
    db.prepare('insert into checkin (rowid,date) values (1,?)').run(Date.now());
    InvoicesDbModule.initSchema(db);
}

export function getApi (db:Database) : SessionDbApi {
    const psSetCheckIn = db.prepare(`update checkin set date = ? where rowid = 1`);
    const psGetCheckIn = db.prepare('select date from checkin where rowid = 1');
    const invoicesDbApi = InvoicesDbModule.getApi(db);

    return {
        meta: MetaDbModule.getApi(db),
        setCheckIn (date) {
            return psSetCheckIn.run(date);
        },
        getCheckIn () {
            return psGetCheckIn.get<{date:number}>()!.date;
        },
        ...invoicesDbApi
    }
}

export default { initSchema, getApi }
