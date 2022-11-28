import { Database } from "/deps/sqlite3/mod.ts";

export interface MetaDbApi {
    db:Database,
    getMetaValue () : { version: string, date: number } | undefined;
}

function initSchema (db:Database) {
    db.prepare(`create table __meta (version text, date int)`).run();
    db.prepare(`insert into __meta (rowid, version, date) values (1, :version, :date)`).run({ version: 'x', date: Date.now() });
}

function getApi (db:Database) : MetaDbApi {
    const psGetMetaValue = db.prepare('select * from __meta where rowid = 1');
    return {
        db,
        getMetaValue () {
            return psGetMetaValue.get();
        }
    }
}

export default { initSchema, getApi }
