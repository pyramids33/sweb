import { default as id128 } from "npm:id128";

import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule from "./metadb.ts";
import type { MetaDbApi } from "./metadb.ts";

import ConfigDbModule from "./configdb.ts";
import type { ConfigDbApi } from "./configdb.ts";

import FilesDbModule from "./filesdb.ts";
import type { FilesDbApi } from "./filesdb.ts";

import InvoicesDbModule from "./invoicesdb.ts";
import type { InvoicesDbApi, InvoiceRow } from "./invoicesdb.ts";
import mstime from "../mstime.ts";

export interface SiteDbApi {
    db:Database
    meta:MetaDbApi
    config:ConfigDbApi
    files:FilesDbApi 
    invoices:InvoicesDbApi
    getNext1000Invoices():InvoiceRow[]
    deleteByRefList(refs:string[]):void
    attachSessionDb(dbFileName:string):void
    copyFromSessionDb():void
    detachSessionDb():void
    getSessionDbCheckIn():number
}

export function initSchema (db:Database) {
    MetaDbModule.initSchema(db);
    FilesDbModule.initSchema(db);
    ConfigDbModule.initSchema(db);
    InvoicesDbModule.initSchema(db);
}

export function getApi (db:Database) : SiteDbApi {
    
    const psNext1000Invoices = db.prepare(`select * from invoices order by ref limit 1000`);

    return {
        db,
        meta: MetaDbModule.getApi(db),
        config: ConfigDbModule.getApi(db),
        files: FilesDbModule.getApi(db),
        invoices: InvoicesDbModule.getApi(db),
        getNext1000Invoices () : InvoiceRow[] {
            return psNext1000Invoices.all();
        },
        deleteByRefList (refs:string[]) {
            const refCSV = refs.filter(x => id128.Ulid.isCanonical(x)).map(x => `'${x}'`).join(',');
            if (refs.length > 0) {
                db.prepare(`delete from invoices where ref in (${refCSV})`).run();
            }
        },
        attachSessionDb (dbFileName:string) { 
            db.prepare(`attach database '${dbFileName}' as sessiondb;`).run(); 
        },
        copyFromSessionDb () { 
            // copy the paid and expired inv to main db
            db.prepare(`
                insert or ignore into main.invoices (
                    ref,created,domain,urlPath,pwfHash,spec,subtotal,paymentMethod,paidAt,txid,txbuf,data,read)
                select ref,created,domain,urlPath,pwfHash,spec,subtotal,paymentMethod,paidAt,txid,txbuf,data,read
                from sessiondb.invoices
                where read = 0 and (paidAt is not null or (paidAt is null and created < :expiry))
            `).run({ expiry: mstime.minsAgo(15) });
        
            // remove the paid and expired inv from main db
            db.prepare(`update sessiondb.invoices set read = 1 where ref in (select ref from main.invoices);`).run();
        },
        getSessionDbCheckIn () {
            return db.prepare(`select date from sessiondb.checkin where rowid = 1`).all()[0].checkin;
        },
        detachSessionDb () {
            db.prepare(`detach database sessiondb;`).run();
        }
    }
}

export default { initSchema, getApi }


