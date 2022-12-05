import { default as id128 } from "npm:id128";
import bsv from "npm:bsv";
import { Context, Router, ServerSentEventTarget } from "/deps/oak/mod.ts";
import { hexToBuffer } from "/deps/hextools/mod.ts";

import { checkSession } from "/middleware/session.ts";
import mstime from "/mstime.ts";
import { Next } from "/types.ts";
import { AppState } from "/appstate.ts";
import { InvoiceSpec } from "/database/invoicesdb.ts";

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

interface InvoiceSpecItem {
    amount: number,
    script: string
}

export function validatePayment (invoiceSpec:InvoiceSpecItem[], tx:bsv.Transaction) : { error?: string } {
    const txOuts:bsv.TxOut[] = [...tx.txOuts];
    let missingOutput = false;

    for (const specItem of invoiceSpec) {
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

export function getBip270Router (abortSignal:AbortSignal) : Router<AppState> {

    const sseEvents:Record<string,ServerSentEventTarget> = {};
    const sseChannel = new BroadcastChannel('invoicepayments');

    sseChannel.addEventListener("message", (event) => {
        const message:string = event.data; 
        if (message.startsWith('PAID ')) {
            const res = sseEvents[message.slice(5)];
            res.dispatchMessage('paid');
            res.close();
        } else if (message === 'CLOSE') {
            for (const res of Object.values(sseEvents)) {
                res.close();
            }
        }
    });
    
    abortSignal.addEventListener("abort", () => sseChannel.close());

    let endpointNum = 0;

    const router = new Router<AppState>();

    router.post('/.bip270/inv', checkSession, async function (ctx:Context<AppState>) {
        const body = Object.fromEntries(await ctx.request.body({ type: "form" }).value);
        const domain = ctx.request.url.hostname; // config
        const sessionId = ctx.state.session.sessionId!;
        const sessionDb = ctx.state.openSessionDb(sessionId);

        // check paywall
        const paywallFile = ctx.state.getPaywallFile();
        const matchResult = paywallFile.matchUrl(body.urlPath);
        
        if (matchResult === undefined || sessionDb.accessCheck(matchResult.match, mstime.hoursAgo(6))) {
            ctx.response.status = 200;
            ctx.response.type = "json";
            ctx.response.body = { error: 'ACCESSIBLE' };
            return;
        }

        const paywallPath = matchResult.match;
        const paywallSpec = matchResult.paywall;
        
        let inv = sessionDb.recentInvoiceByUrlPath(paywallPath, mstime.minsAgo(5));
        
        if (inv === undefined) {
            
            const countersDb = ctx.state.openCountersDb();
            const counters:{ xpubstr:string, counter:number }[] = [];

            countersDb.db.transaction(function () {
                for (const item of paywallSpec.outputs) {
                    const xpubstr = paywallFile.xpubs[item.xpubname].toString();
                    const counter = countersDb.nextValue(xpubstr);
                    counters.push({ xpubstr, counter });
                }
            })(null);

            const invoiceSpec:InvoiceSpec = { 
                pattern:paywallSpec.pattern, 
                outputs: paywallSpec.outputs.map((specItem, i) => { 
                    const counter = counters[i].counter;
                    const xpubstr = counters[i].xpubstr;
                    const xpub = paywallFile.xpubs[specItem.xpubname];
                    const pubKey = xpub.deriveChild(0).deriveChild(counter).pubKey;
                    const script = bsv.Address.fromPubKey(pubKey).toTxOutScript().toHex();
                    return { 
                        description: specItem.description, 
                        amount: specItem.amount, 
                        xpubstr, 
                        counter,
                        script
                    }
                })
            }

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

        const dataURL = 'bitcoin:?sv&r=' + encodeURIComponent(`https://${domain}/.bip270/inv/req?ref=${inv.ref}&token=${sessionId}`);
        
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
    router.get('/.bip270/inv/req', allowCORS, function (ctx:Context<AppState>) {
        const domain = ctx.request.url.hostname; // config
        const query = Object.fromEntries(ctx.request.url.searchParams)
        
        if (!query.sessionId || !id128.Ulid.isCanonical(query.sessionId)) {
            ctx.response.status = 400;
            return;
        }

        const sessionDb = ctx.state.openSessionDb(query.sessionId, { create: false });

        const invoice = sessionDb.invoiceByRef(query.ref);
    
        if (invoice === undefined || invoice.paidAt || (Date.now() - invoice.created) > mstime.mins(15)) {
            ctx.response.status = 404;
            return;
        }

        const outputs = JSON.parse(invoice.spec).map((item:InvoiceSpecItem) => { return { script: item.script, amount: item.amount }});

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

    router.post('/.bip270/inv/pay', allowCORS, async function (ctx:Context<AppState>) {
        const config = ctx.state.config;
        const body = Object.fromEntries(await ctx.request.body({ type: "form" }).value);
        
        if (!body.sessionId || !id128.Ulid.isCanonical(body.sessionId)) {
            ctx.response.status = 400;
            return;
        }

        const sessionDb = ctx.state.openSessionDb(body.sessionId, { create: false });

        const invoice = sessionDb.invoiceByRef(body.ref);
    
        if (invoice === undefined || invoice.paidAt || (Date.now() - invoice.created) > mstime.mins(15)) {
            ctx.response.status = 404;
            return;
        }

        const mAPIEndpoint = config.mAPIEndpoints[endpointNum];
        
        if (typeof(body.transaction) !== 'string') {
            ctx.response.status = 400;
            return;
        }

        const txbuf = new Uint8Array(hexToBuffer(body.transaction));
        const tx:bsv.Tx = bsv.Tx.fromBuffer(txbuf);

        const invSpecItems:InvoiceSpecItem[] = JSON.parse(invoice.spec);

        const validationResult = validatePayment(invSpecItems, tx);

        if (validationResult.error) {
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
            sseChannel.postMessage(`PAID ${body.sessionId} ${body.ref}`);
        } else {
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

    router.get('/.bip270/inv/devpay', checkSession, function (ctx:Context<AppState>) {
        const config = ctx.state.config;

        if (config.env !== 'dev') {
            ctx.response.status = 404;
            return;
        }

        const query = Object.fromEntries(ctx.request.url.searchParams)
        
        if (!query.sessionId || !id128.Ulid.isCanonical(query.sessionId)) {
            ctx.response.status = 400;
            return;
        }

        const sessionDb = ctx.state.openSessionDb(query.sessionId, { create: false });
        const invoice = sessionDb.invoiceByRef(query.ref);

        if (invoice === undefined) {
            ctx.response.status = 404;
            return;
        }

        sessionDb.payInvoice(invoice.ref, Date.now(), 'devpay', undefined, undefined);
        
        sseChannel.postMessage(`PAID ${query.sessionId} ${query.ref}`);

        ctx.response.status = 200;
        ctx.response.type = "json";
        ctx.response.body = {};
    });

    router.get('/.bip270/inv/sse', checkSession, async function (ctx:Context<AppState>) {
        const query = Object.fromEntries(ctx.request.url.searchParams);
        const sessionDb = ctx.state.openSessionDb(ctx.state.session.sessionId!, { create: false });
        const invoice = sessionDb.invoiceByRef(query.ref);
    
        if (invoice === undefined || invoice.paidAt || (invoice.created < mstime.minsAgo(15))) {
            ctx.response.status = 404;
            return;
        }

        const target = ctx.sendEvents();

        //target.close();

        if (invoice.paidAt !== undefined && invoice.paidAt !== null) {
            // on iPhone, after switching to app and paying, the connection is closed and reopened.
            // send update if already paid.
            target.dispatchMessage('paid');
            await target.close();
            return;
        }
    
        target.addEventListener("close", (_evt) => {
            console.log('sse close');
            const key =`${ctx.state.session.sessionId!} ${invoice.ref}`;
            delete sseEvents[key]; 
        });

        sseEvents[`${ctx.state.session.sessionId!} ${invoice.ref}`] = target;
    });

    return router;
}