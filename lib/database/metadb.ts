import { BindValue, Database } from "/deps/sqlite3/mod.ts";

export interface MetaRow extends Record<string, unknown> {
    version: string 
    date: number 
    jsondata: string
}

export interface MetaDbApi {
    db:Database
    getMetaRow () : MetaRow | undefined
    getValue (jsonPath:string) : unknown|undefined
    setValue (jsonPath:string, value:unknown) : number
    removeValue (jsonPath:string) : number
}

function initSchema (db:Database) {
    db.prepare(`create table __meta (version text, date int, jsondata text)`).run();
    db.prepare(`insert into __meta (rowid, version, date, jsondata) values (1, :version, :date, '{}')`).run({ version: '1.0.0', date: Date.now() });
}

function getApi (db:Database) : MetaDbApi {
    const psGetMetaRow = db.prepare('select * from __meta where rowid = 1');
    const psSetJsonValue = db.prepare(`update __meta set jsondata = json_set(jsondata, ?, ?) where rowid = 1`);
    const psGetJsonValue = db.prepare(`
        select json_extract(jsondata,:q) as jsondata, 
            json_type(jsondata,:q) as type 
        from __meta where rowid = 1 `);

    const psRemoveJsonValue = db.prepare(`update __meta set jsondata = json_remove(jsondata, ?) where rowid = 1`);
    return {
        db,
        getMetaRow () {
            return psGetMetaRow.get<MetaRow>();
        },
        getValue (jsonPath:string) {
            const row = psGetJsonValue.get<MetaRow>(jsonPath);
            const value = row?.jsondata;

            if (value === undefined || value === null) {
                return undefined;
            }

            const type = row?.type;

            if (type === 'object') {
                return JSON.parse(value);
            }

            return value;
        },
        setValue (jsonPath:string, value:BindValue) {
            if (value === undefined || value === null) {
                return psSetJsonValue.run(jsonPath, null);
            }
            return psSetJsonValue.run(jsonPath, value);
        },
        removeValue (jsonPath:string) {
            return psRemoveJsonValue.run(jsonPath);
        }
    }
}

export default { initSchema, getApi }
