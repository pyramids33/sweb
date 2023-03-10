import { default as id128 } from "npm:id128";
import bsv from "npm:bsv";
import { Context, Router } from "/deps/oak/mod.ts";
import { Buffer } from "/deps/std/node/buffer.ts";

import mstime from "/lib/mstime.ts";

import { checkSession, readWriteSessionHeaders } from "/server/middleware/session.ts";
import { Next } from "/server/types.ts";
import { RequestState } from "/server/appstate.ts";
import { InvoiceSpec } from "/server/database/invoicesdb.ts";

interface InvoiceSpecItem {
    amount: number,
    script: string
}

// https://github.com/moneybutton/bips/blob/master/bip-0270.mediawiki#PaymentRequest

async function allowCORS (ctx:Context, next:Next) {
    ctx.response.headers.set('Access-Control-Allow-Origin', '*')
    ctx.response.headers.set('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
    ctx.response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    if (ctx.request.method === 'OPTIONS') {
        ctx.response.status = 200;
        return;
    }

    await next();
}

export function validatePayment (invSpecItems:InvoiceSpecItem[], tx:bsv.Transaction) : { error?: string } {
    const txOuts:bsv.TxOut[] = [...tx.txOuts];
    let missingOutput = false;

    for (const specItem of invSpecItems) {
        const n = tx.txOuts.findIndex((txOut:bsv.TxOut) => 
            specItem.amount === txOut.valueBn.toNumber() && specItem.script === txOut.script.toHex());

        if (n === -1) {
            missingOutput = true;
            break;
        }

        txOuts.splice(n, 1);
    }

    if (missingOutput) {
        return { error: 'missing output' };
    }

    return {};
}

export function getBip270Router () : Router<RequestState> {

    let endpointNum = 0;

    const router = new Router<RequestState>();
    
    router.use(readWriteSessionHeaders);
    
    router.get('/.bip270/inv/sse', checkSession, async function (ctx:Context<RequestState>) {
        const session = ctx.state.session!;
        const app = ctx.state.app!;
        const query = Object.fromEntries(ctx.request.url.searchParams);
        const sessionDb = app.openSessionDb(session.sessionId!, { create: false });
        const invoice = sessionDb.invoiceByRef(query.ref);
    
        if (invoice === undefined || invoice.paidAt || (invoice.created < mstime.minsAgo(15))) {
            ctx.response.status = 404;
            return;
        }

        const key = session.sessionId! + ' ' + invoice.ref;
        const target = ctx.sendEvents();

        app.sse.addTarget(key, target);

        if (invoice.paidAt !== undefined && invoice.paidAt !== null) {
            // on iPhone, after switching to app and paying, the connection is closed and reopened.
            // send update if already paid.
            await app.sse.onPayment(key);
        }
    });

    router.post('/.bip270/inv', checkSession, async function (ctx:Context<RequestState>) {
        const session = ctx.state.session!;
        const app = ctx.state.app!;
        const body = Object.fromEntries(await ctx.request.body({ type: 'form' }).value);
        const domain = ctx.request.url.hostname; // config
        const sessionId = session.sessionId!;
        const sessionDb = app.openSessionDb(sessionId);

        //console.log(sessionId)

        // check paywall
        const paywallFile = await app.getPaywallFile();
        const matchResult = paywallFile.matchUrl(body.urlPath);
        
        if (matchResult === undefined || sessionDb.accessCheck(matchResult.match, mstime.hoursAgo(6))) {
            ctx.response.status = 200;
            ctx.response.type = 'json';
            ctx.response.body = { error: 'ACCESSIBLE' };
            return;
        }

        const paywallPath = matchResult.match;
        const paywallSpec = matchResult.spec;
        
        let inv = sessionDb.recentInvoiceByUrlPath(paywallPath, mstime.minsAgo(5));
        
        if (inv === undefined) {
            
            const countersDb = app.openCountersDb();
            const workerId = app.workerId;

            const invoiceSpec:InvoiceSpec = { pattern: matchResult.pattern, outputs: [] };
            const xpub = await app.getXPub();
            const xpubstr = xpub.toString()

            countersDb.db.transaction(function () {
                for (const item of paywallSpec.outputs) {
                    const counter = countersDb.nextValue(xpubstr);
                    const drvpath = `m/${workerId}/${counter}`;
                    const pubKey = xpub.derive(drvpath).pubKey;
                    const script = bsv.Address.fromPubKey(pubKey).toTxOutScript().toHex();

                    invoiceSpec.outputs.push({ 
                        description: item.description, 
                        amount: item.amount, 
                        xpubstr, 
                        drvpath,
                        script
                    })
                }
            })(null);

            inv = sessionDb.addInvoice({ 
                ref: id128.Ulid.generate().toCanonical(),
                created: Date.now(), 
                domain, 
                urlPath: matchResult.match,
                pwfHash: '', 
                spec: JSON.stringify(invoiceSpec), 
                subtotal: invoiceSpec.outputs.reduce((prev, curr) => prev + curr.amount, 0)
            });
        }
        
        if (inv === undefined) {
            ctx.response.status = 500;
            ctx.response.type = "json";
            ctx.response.body = { error: 'ERR_INVOPEN' };
            return;
        }

        const dataURL = 'bitcoin:?sv&r=' + encodeURIComponent(`https://${domain}/.bip270/inv/req?ref=${inv.ref}&sessionId=${sessionId}`);
        
        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {
            ref: inv.ref,
            urlPath: inv.urlPath,
            subtotal: inv.subtotal,
            dataURL,
            expiry: inv.created + mstime.mins(5)
        }
    });

    router.options('/.bip270/inv/req', allowCORS);
    router.get('/.bip270/inv/req', allowCORS, function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const domain = ctx.request.url.hostname; // config
        const query = Object.fromEntries(ctx.request.url.searchParams)
        
        if (!query.sessionId || !id128.Ulid.isCanonical(query.sessionId)) {
            ctx.response.status = 400;
            return;
        }

        const sessionDb = app.openSessionDb(query.sessionId, { create: false });

        const invoice = sessionDb.invoiceByRef(query.ref);
    
        if (invoice === undefined || invoice.paidAt || (Date.now() - invoice.created) > mstime.mins(15)) {
            ctx.response.status = 404;
            return;
        }

        const invSpec:InvoiceSpec = JSON.parse(invoice.spec);
        const outputs = invSpec.outputs.map((item:InvoiceSpecItem) => { return { script: item.script, amount: item.amount }});

        const paymentRequest = {
            network: 'bitcoin',
            outputs,
            creationTimestamp: Math.floor(Date.now()/1000),
            expirationTimestamp: Math.floor((Date.now()+mstime.mins(6))/1000),
            memo: `https://${domain}${invoice.urlPath}`,
            paymentUrl: `https://${domain}/.bip270/inv/pay?ref=${query.ref}&sessionId=${query.sessionId}`,
            merchantData: query.ref
        };

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = paymentRequest;
    });

    router.options('/.bip270/inv/pay', allowCORS);

    router.post('/.bip270/inv/pay', allowCORS, async function (ctx:Context<RequestState>) {
        const app = ctx.state.app!;
        const config = app.config;
        const body = await ctx.request.body({ type: "json" }).value;
        const query = Object.fromEntries(ctx.request.url.searchParams);

        if (!(query.sessionId && id128.Ulid.isCanonical(query.sessionId))) {
            console.log('invalid session id');
            ctx.response.status = 400;
            return;
        }

        const sessionDb = app.openSessionDb(query.sessionId, { create: false });

        const invoice = sessionDb.invoiceByRef(query.ref);
    
        if (invoice === undefined || invoice.paidAt || (Date.now() - invoice.created) > mstime.mins(15)) {
            console.log('invalid invoice');
            ctx.response.status = 404;
            return;
        }

        const mAPIEndpoint = config.mAPIEndpoints[endpointNum];
        
        if (typeof(body.transaction) !== 'string') {
            console.log('invalid transaction');
            ctx.response.status = 400;
            return;
        }

        const txbuf = Buffer.from(body.transaction,'hex');
        const tx:bsv.Tx = bsv.Tx.fromHex(body.transaction);

        const invSpecItems:InvoiceSpecItem[] = JSON.parse(invoice.spec).outputs;

        const validationResult = validatePayment(invSpecItems, tx);

        if (validationResult.error) {
            console.log(validationResult);
            ctx.response.status = 200;
            ctx.response.type = "json";
            ctx.response.body = { payment: body, memo: validationResult.error, error: 1 }
            return;
        } 

        let mapiRes;

        try {
            mapiRes = await fetch(mAPIEndpoint.url, { 
                method: 'POST', 
                body: JSON.stringify({ rawtx: body.transaction }),
                headers: mAPIEndpoint.extraHeaders 
            });
        } catch {
            console.log('broadcast failed');
            endpointNum = (endpointNum + 1) % config.mAPIEndpoints.length;
            ctx.response.status = 200;
            ctx.response.type = "json";
            ctx.response.body = { payment: body, memo: 'broadcast failed', error: 2 };
            return;
        }
            
        let mapiResBody;
        let payload;
        
        try {
            mapiResBody = await mapiRes.json();
            payload = JSON.parse(mapiResBody.payload);
        } catch {
            console.log('error parsing mapi response',mapiResBody,payload);
            ctx.response.status = 200;
            ctx.response.type = "json";
            ctx.response.body = { payment: body, memo: 'error parsing mapi response', error: 3 };
            return;
        }

        if (payload.returnResult === 'success'
            || payload.resultDescription === 'Transaction already in the mempool'
            || payload.resultDescription === 'Transaction already known'
            || payload.resultDescription === '257 txn-already-known'
        ) {
            sessionDb.payInvoice(invoice.ref, Date.now(), 'bip270 ' + mAPIEndpoint.name, tx.id(), txbuf);

            await app.sse.onPayment(query.sessionId + ' ' + query.ref);
            
            if (self.postMessage) {
                self.postMessage({ message: 'payment', target: query.sessionId + ' ' + query.ref });
            } 

        } else {
            console.log('error payload',payload);
            ctx.response.status = 200;
            ctx.response.type = "json";
            ctx.response.body = { payment: body, memo: payload.resultDescription, error: 4 };
            return;
        }
            
        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = { payment: body, memo: 'Access Granted', error: 0 };
        return;
    });

    router.get('/.bip270/inv/devpay', checkSession, async function (ctx:Context<RequestState>) {
        const session = ctx.state.session!;
        const app = ctx.state.app!;
        const config = app.config;

        if (config.env !== 'dev') {
            ctx.response.status = 404;
            return;
        }

        const query = Object.fromEntries(ctx.request.url.searchParams);

        if (!query.ref || !id128.Ulid.isCanonical(query.ref)) {
            ctx.response.status = 400;
            return;
        }

        const sessionDb = app.openSessionDb(session.sessionId!, { create: false });
        const invoice = sessionDb.invoiceByRef(query.ref);

        if (invoice === undefined) {
            ctx.response.status = 404;
            return;
        }

        const spec = JSON.parse(invoice.spec);
        const tx = new bsv.Tx();
        
        for (const item of spec.outputs) {
            tx.addTxOut(new bsv.Bn(item.amount), bsv.Script.fromHex(item.script));
        }
        
        sessionDb.payInvoice(invoice.ref, Date.now(), 'devpay', tx.id(), tx.toBuffer());

        await app.sse.onPayment(session.sessionId + ' ' + query.ref);
        
        if (self.postMessage) {
            self.postMessage({ message: 'payment', target: session.sessionId + ' ' + query.ref });
        }

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    return router;
}