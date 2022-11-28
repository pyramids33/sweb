import { Database } from "/deps/sqlite3/mod.ts";

export interface ConfigDbApi {
    db:Database,
    set (config:Record<string,string>) : number,
    all () : Record<string,string>,
    getOne(name:string[]) : string|undefined,
    get (...names:string[]) : Record<string,string>,
    remove (...names:string[]) : number,
}

export interface FileRow extends Record<string, unknown> {
    urlPath:string, 
    hash:string, 
    size:number, 
    storagePath:string, 
    mimeType:string
}

export interface ConfigRow extends Record<string, string> {
    name:string,
    value:string
}

export function initSchema (db:Database) {
    db.prepare(`create table config (name text primary key, value text)`).run();
}

export function getApi (db:Database) : ConfigDbApi {

    const psSetConfig = db.prepare(`
        insert into config (name,value) values($name, $value) 
        on conflict do update set value = $value where name = $name`);

    const psGetAllConfig = db.prepare(`select name, value from config`);
    const psGetConfig = db.prepare(`select value from config where name = ?`);

    const psDeleteConfig = db.prepare(`delete from config where name = ?`);

    return {
        db,
        set(config:Record<string,string>) {
            let n = 0

            db.transaction(function () {
                for (const[ name, value ] of Object.entries(config)) {
                    n += psSetConfig.run({ name, value });
                }
            })(null);

            return n;
        },

        all () {
            const result : Record<string,string> = {};
            const rows = psGetAllConfig.all<ConfigRow>();
            
            for (const row of rows) {
                result[row.name] = row.value;
            }

            return result;
        },

        getOne (name) {
            return psGetConfig.get<ConfigRow>(name)?.value;
        },

        get (...names) {
            const result : Record<string,string> = {};

            for (const name of names) {
                const value = psGetConfig.get<ConfigRow>(name)?.value;
                if (value !== undefined) {
                    result[name] = value;
                }
            }
            
            return result;
        },

        remove (...names) {
            let n = 0

            db.transaction(function () {
                for (const name of names) {
                    n += psDeleteConfig.run(name);
                }
            })(null);

            return n;
        }
    }
}

export default { initSchema, getApi }