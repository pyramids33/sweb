import { Database } from "/deps/sqlite3/mod.ts";

export interface InvoicesDbApi {
    db:Database,
    addInvoice (f:InvoiceRow) : InvoiceRow|undefined,
    invoiceByRef (ref:string) : InvoiceRow|undefined,
    listInvoices () : InvoiceRow[]
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
    txbuf?:Uint8Array
}

export interface InvoiceSpec {
    pattern: string
    outputs: InvoiceSpecOutput[]
}

export interface InvoiceSpecOutput {
    description: string
    amount: number
    xpubstr: string
    counter: number
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
            txbuf blob);
    `).run();       
    db.prepare(`create index invoices_paidAt on invoices(paidAt);`).run();
}

export function getApi (db:Database) : InvoicesDbApi {

    const psAddInvoice = db.prepare(`
        insert into invoices (ref, created, domain, urlPath, pwfHash, spec, subtotal, paymentMethod, paidAt, data, txid, txbuf)
        values (:ref, :created, :domain, :urlPath, :pwfHash, :spec, :subtotal, :paymentMethod, :paidAt, :data, :txid, :txbuf) 
        on conflict do nothing returning *`);

    const psInvoiceByRef = db.prepare(`select * from invoices where ref = ?`);

    const psListInvoices = db.prepare('select * from invoices order by ref');

    return {
        db,
        addInvoice ({ ref, created, domain, urlPath, pwfHash, spec, subtotal, paymentMethod, paidAt, data, txid, txbuf }) {
            return psAddInvoice.get({ ref, created, domain, urlPath, pwfHash, spec, subtotal, paymentMethod, paidAt, data, txid, txbuf });
        },
        invoiceByRef (ref) {
            return psInvoiceByRef.get(ref);
        },
        listInvoices () {
            return psListInvoices.all();
        }
    }
}

export default { initSchema, getApi }