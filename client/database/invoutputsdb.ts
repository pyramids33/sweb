import { Database } from "/deps/sqlite3/mod.ts";

export interface InvoiceOutputsDbApi {
    db:Database,
    addOutput (f:InvoiceOutputRow) : number
    nextUnspentOutput (afterRowId:number) : InvoiceOutputRow
    markSpent(invoiceRef:string, invTxOutNum:number, redeemTxHash:string, redeemTxInNum:number) : number
    list(): InvoiceOutputRow[]
}

export interface InvoiceOutputRow extends Record<string, unknown> {
    rowid?:number
    invoiceRef:string
    invTxHash:string
    amount:number
    description?:string
    address?:string
    xpubstr:string
    drvpath:string
    script:string
    invTxOutNum:number
    redeemTxHash?:string
    redeemTxInNum?:number
}

export function initSchema (db:Database) {
    db.prepare(`
        create table invoiceOutputs (
            invTxHash text,
            invTxOutNum integer,
            invoiceRef text,
            amount integer,
            description text,
            address text,
            xpubstr text,
            drvpath text,
            script text,
            redeemTxHash text,
            redeemTxInNum integer
        );
    `).run();
    
    db.prepare('create unique index if not exists invoiceOutputs_invTxHash_invTxOutNum on invoiceOutputs(invTxHash, invTxOutNum)').run();
    db.prepare('create index if not exists invoiceOutputs_redeemTxHash on invoiceOutputs(redeemTxHash) ').run();
    db.prepare('create index if not exists invoiceOutputs_invoiceRef on invoiceOutputs(invoiceRef) ').run();
}

export function getApi (db:Database) : InvoiceOutputsDbApi {

    const psListOutputs = db.prepare(`select * from invoiceOutputs order by invoiceRef,invTxOutNum`);
    const psAddOutput = db.prepare(`
        insert into invoiceOutputs (invTxHash,invTxOutNum,invoiceRef,amount,description,address,xpubstr,drvpath,script,redeemTxHash,redeemTxInNum)
        values (:invTxHash,:invTxOutNum,:invoiceRef,:amount,:description,:address,:xpubstr,:drvpath,:script,:redeemTxHash,:redeemTxInNum) 
        on conflict do nothing`);

    const psNextUnspentOutput = db.prepare(`
        select rowid,* from invoiceOutputs where redeemTxHash is null and rowid > ? order by rowid limit 1`)

    const psMarkSpent = db.prepare(`
        update invoiceOutputs set redeemTxHash = :redeemTxHash, redeemTxInNum = :redeemTxInNum 
        where invTxHash = :invTxHash and invTxOutNum = :invTxOutNum`)

    return {
        db,
        addOutput ({
            invTxHash, invTxOutNum, invoiceRef, amount, description, address, xpubstr, drvpath, script, 
            redeemTxHash, redeemTxInNum
        }) {
            return psAddOutput.run({
                invTxHash,
                invTxOutNum,
                invoiceRef,
                amount,
                description: description||null,
                address: address||null,
                xpubstr,
                drvpath,
                script,
                redeemTxHash:redeemTxHash||null,
                redeemTxInNum:redeemTxInNum||null
            });
        },
        nextUnspentOutput (afterRowId) {
            return psNextUnspentOutput.all<InvoiceOutputRow>(afterRowId)[0];
        },
        markSpent(invTxHash, invTxOutNum, redeemTxHash, redeemTxInNum) {
            return psMarkSpent.run({ invTxHash, invTxOutNum, redeemTxHash, redeemTxInNum })
        },
        list () {
            return psListOutputs.all();
        },
    }
}

export default { initSchema, getApi }