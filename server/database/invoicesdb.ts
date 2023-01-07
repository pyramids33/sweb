import { default as id128 } from "npm:id128";
import { Database } from "/deps/sqlite3/mod.ts";

export interface InvoicesDbApi {
    db:Database
    addInvoice (f:InvoiceRow) : InvoiceRow|undefined
    invoiceByRef (ref:string) : InvoiceRow|undefined
    listInvoices () : InvoiceRow[]
    paidUnreadInvoices (expiry:number) : InvoiceRow[]
    payInvoice (ref:string, paidAt:number, paymentMethod:string, txid?:string, txbuf?:Uint8Array) : number
    recentInvoiceByUrlPath (urlPath:string, expiry:number) : InvoiceRow|undefined
    accessCheck (urlPath:string,cutOff:number) : boolean
    markInvoiceRead (ref:string, readValue:number) : number
    getNext1000Invoices(afterRef:string):InvoiceRow[]
    deleteByRefList(refs:string[]):void
}

export interface InvoiceRow extends Record<string, unknown> {
    ref:string, 
    created:number, 
    domain:string, 
    urlPath:string, 
    pwfHash:string, 
    spec:string, 
    subtotal:number, 
    paymentMethod?:string, 
    paidAt?:number, 
    data?:string, 
    txid?:string, 
    txbuf?:Uint8Array,
    read?:boolean
}

export interface InvoiceSpec {
    pattern: string
    outputs: InvoiceSpecOutput[]
}

export interface InvoiceSpecOutput {
    description?: string
    amount: number
    xpubstr: string
    drvpath: string
    script: string
}


export function initSchema (db:Database) {
    db.prepare(`
        create table invoices (
            ref text primary key,
            created int,
            domain text,                
            urlPath text,
            pwfHash text,
            spec text,
            subtotal int,
            paymentMethod text,
            paidAt int,
            data text,
            txid text,
            txbuf blob,
            read boolean);
    `).run();       
    db.prepare(`create index invoices_paidAt on invoices(paidAt);`).run();
}

export function getApi (db:Database) : InvoicesDbApi {

    const psAddInvoice = db.prepare(`
        insert into invoices (ref, created, domain, urlPath, pwfHash, spec, subtotal, paymentMethod, paidAt, data, txid, txbuf, read)
        values (:ref, :created, :domain, :urlPath, :pwfHash, :spec, :subtotal, :paymentMethod, :paidAt, :data, :txid, :txbuf, :read) 
        on conflict do nothing returning *`);

    const psInvoiceByRef = db.prepare(`select * from invoices where ref = ?`);

    const psListInvoices = db.prepare('select * from invoices order by ref');

    const psListPaidUnreadInvoices = db.prepare(`
        select * from invoices where read = 0 and (paidAt is not null or (paidAt is null and created < :expiry)) limit 1000`);

    const psPayInvoice = db.prepare(`
        update invoices set 
            data = :data, txid = :txid, txbuf = :txbuf, paidAt = :paidAt, paymentMethod = :paymentMethod
        where ref = :ref and paidAt is null`);

    const psRecentInvoiceByUrlPath = db.prepare(`
        select * from invoices where urlPath = :urlPath and created > :expiry and paidAt is null limit 1`);    

    const psAccessCheck = db.prepare(`select ref from invoices where urlPath = :urlPath and paidAt > :cutoff LIMIT 1`);   

    const psMarkInvoiceRead = db.prepare('update invoices set read = ? where ref = ?');

    const psNext1000Invoices = db.prepare(`select * from invoices where ref > ? order by ref limit 1000`);

    return {
        db,
        addInvoice ({ ref, created, domain, urlPath, pwfHash, spec, subtotal, paymentMethod, paidAt, data, txid, txbuf, read }) {
            return psAddInvoice.all<InvoiceRow>({
                ref, created, domain, urlPath, pwfHash, spec, subtotal, 
                paymentMethod: paymentMethod||null, 
                paidAt: paidAt||null, 
                data: data||null, 
                txid: txid||null, 
                txbuf: txbuf||null,
                read: read||false
            })[0];
        },
        invoiceByRef (ref) {
            return psInvoiceByRef.get(ref);
        },
        listInvoices () {
            return psListInvoices.all();
        },
        accessCheck (urlPath, cutoff) {
            return psAccessCheck.get({ urlPath, cutoff }) !== undefined;        
        },
        paidUnreadInvoices (expiry:number) {
            return psListPaidUnreadInvoices.all({ expiry });
        },
        payInvoice (ref, paidAt, paymentMethod, txid, txbuf) {
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
        markInvoiceRead (ref:string, readValue:number) {
            return psMarkInvoiceRead.run(readValue, ref);
        },
        getNext1000Invoices (afterRef = '') : InvoiceRow[] {
            return psNext1000Invoices.all(afterRef);
        },
        deleteByRefList (refs:string[]) {
            const refCSV = refs.filter(x => id128.Ulid.isCanonical(x)).map(x => `'${x}'`).join(',');
            if (refs.length > 0) {
                db.prepare(`delete from invoices where ref in (${refCSV})`).run();
            }
        },
    }
}

export default { initSchema, getApi }