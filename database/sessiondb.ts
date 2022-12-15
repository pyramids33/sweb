import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule from "./metadb.ts";
import type { MetaDbApi } from "./metadb.ts";

import InvoicesDbModule from "./invoicesdb.ts";
import { InvoiceRow } from "./invoicesdb.ts";

export interface SessionDbApi {
    db:Database
    meta:MetaDbApi
    setCheckIn (date:number):number 
    getCheckIn () : number
    accessCheck (urlPath:string,cutOff:number) : boolean
    addInvoice (f:{ ref:string, created:number, domain:string, urlPath:string, pwfHash:string, spec:string, subtotal:number }) : InvoiceRow|undefined
    payInvoice (ref:string, paidAt:number, paymentMethod:string, txid?:string, txbuf?:Uint8Array) : number
    recentInvoiceByUrlPath (urlPath:string, expiry:number) : InvoiceRow|undefined
    invoiceByRef (ref:string) : InvoiceRow|undefined,
    listInvoices () : InvoiceRow[]
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

    const psAccessCheck = db.prepare(`select ref from invoices where urlPath = :urlPath and paidAt > :cutoff LIMIT 1`);

    const psPayInvoice = db.prepare(`
        update invoices set 
            data = :data, txid = :txid, txbuf = :txbuf, paidAt = :paidAt, paymentMethod = :paymentMethod
        where ref = :ref and paidAt is null`);

    const psRecentInvoiceByUrlPath = db.prepare(`
        select * from invoices where urlPath = :urlPath and created > :expiry and paidAt is null limit 1`);    

    const invoicesDbApi = InvoicesDbModule.getApi(db);

    return {
        db,
        meta: MetaDbModule.getApi(db),
        setCheckIn (date) {
            return psSetCheckIn.run(date);
        },
        getCheckIn () {
            return psGetCheckIn.get<{date:number}>()!.date;
        },
        accessCheck (urlPath, cutoff) {
            return psAccessCheck.get({ urlPath, cutoff }) !== undefined;        
        },
        addInvoice ({ ref, created, domain, urlPath, pwfHash, spec, subtotal }) {
            return invoicesDbApi.addInvoice({ ref, created, domain, urlPath, pwfHash, spec, subtotal });
        },
        payInvoice(ref, paidAt, paymentMethod, txid, txbuf) {
            return psPayInvoice.run({ 
                ref, 
                paidAt, 
                data: null, 
                paymentMethod: paymentMethod||null, 
                txid: txid||null, 
                txbuf: txbuf||null 
            });
        },
        recentInvoiceByUrlPath (urlPath, expiry) {
            return psRecentInvoiceByUrlPath.get({ urlPath, expiry });
        },
        invoiceByRef: invoicesDbApi.invoiceByRef,
        listInvoices: invoicesDbApi.listInvoices,
    }
}

export default { initSchema, getApi }
