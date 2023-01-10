import bsv from "npm:bsv";
import { delay } from "/deps/std/async/mod.ts";
import * as path from "/deps/std/path/mod.ts";
import { DatabaseOpenOptions } from "/deps/sqlite3/mod.ts";

import { openDb } from "/lib/database/mod.ts";
import mstime from "/lib/mstime.ts";
import { PaywallFile } from "/lib/paywallfile.ts";

import CountersDbModule, { CountersDbApi } from "/server/database/countersdb.ts";
import SiteDbModule, { SiteDbApi } from "/server/database/sitedb.ts";
import SessionDbModule, { SessionDbApi } from "/server/database/sessiondb.ts";

import { SitePath } from "/server/sitepath.ts";
import { Config } from "/server/types.ts";
import { SSECache } from "/server/ssecache.ts";
import { Session } from "/server/middleware/session.ts";


interface SessionDbCacheEntry {
    db: SessionDbApi,
    lastAccess: number
}

export interface RequestState {
    app?: AppState
    session?: Session
}

export class AppState {

    config: Config
    sitePath: SitePath
    workerId = 0

    sse:SSECache = new SSECache()
    #siteDb?: SiteDbApi
    #countersDb?: CountersDbApi
    #sessionDbCache: Record<string, SessionDbCacheEntry> = {};
    #paywallFile?: PaywallFile
    #xpub?: bsv.Bip32

    constructor (config:Config){
        this.config = config;
        this.sitePath = new SitePath(config.sitePath);
    }

    openCountersDb () : CountersDbApi {
        if (this.#countersDb === undefined) {
            this.#countersDb = openDb(CountersDbModule, this.sitePath.countersDbPath(this.workerId));
        }
        return this.#countersDb;
    }

    openSiteDb (forceReload=false) : SiteDbApi {
        if (this.#siteDb === undefined || forceReload) {
            if (forceReload && this.#siteDb) {
                this.#siteDb.db.close();
            }
            this.#siteDb = openDb(SiteDbModule, this.sitePath.siteDbPath);
        }
        return this.#siteDb;
    }

    openSessionDb (sessionId:string, options?:DatabaseOpenOptions) : SessionDbApi {
        if (this.#sessionDbCache[sessionId]) {
            this.#sessionDbCache[sessionId].lastAccess = Date.now();
            return this.#sessionDbCache[sessionId].db;
        }

        const db = openDb(SessionDbModule, this.sitePath.sessionDbPath(sessionId), options);
        this.#sessionDbCache[sessionId] = { db, lastAccess: Date.now() };
        return db;
    }

    async unCacheSessionDbs () {

        const keys = Object.keys(this.#sessionDbCache);

        while (keys.length > 0) {
            const keyBatch = keys.splice(0, 1000);

            for (const key of keyBatch) {
                const entry = this.#sessionDbCache[key];
                if (entry.lastAccess < mstime.hoursAgo(1)) {
                    entry.db.db.close();
                    delete this.#sessionDbCache[key];
                }
            }

            await delay(0);
        }
    }

    async runSessionDbUncacher (abortSignal: AbortSignal, delayMs:number) {
        if (abortSignal.aborted) {
            return;
        }
        await this.unCacheSessionDbs();
        Deno.unrefTimer(setTimeout(() => this.runSessionDbUncacher(abortSignal, delayMs).catch(console.error), delayMs));
    }

    async copyFromSessionDbs (abortSignal:AbortSignal) {

        const dirEntries = Deno.readDir(this.sitePath.sessionDbsPath);

        for await (const dirEnt of dirEntries) {

            if (dirEnt.isFile && dirEnt.name.endsWith('.db')) {

                const sessionId = dirEnt.name.slice(0,-3);
                const siteDb = this.openSiteDb();
                const sessionDb = this.openSessionDb(sessionId);
                let invoices = sessionDb.paidUnreadInvoices(mstime.minsAgo(15));
                
                while (invoices.length > 0) {

                    siteDb.db.transaction(function () {
                        for (const invoice of invoices) {
                            siteDb.invoices.addInvoice(invoice);
                        }                
                    })(null);

                    const batchNum = Date.now();

                    sessionDb.db.transaction(function () {
                        for (const invoice of invoices) {
                            sessionDb.markInvoiceRead(invoice.ref, batchNum);
                        }  
                    })(null);

                    invoices = sessionDb.paidUnreadInvoices(mstime.minsAgo(15));
                   
                    await delay(0);

                    if (abortSignal.aborted) {
                        break;
                    }
                }

                const sessionCheckIn = sessionDb.getCheckIn()
                const sessionDbFileName = path.join(this.sitePath.sessionDbsPath, dirEnt.name);

                /* If the session has not checked in for 8 hours, the cookie must be expired */
                if (sessionCheckIn && sessionCheckIn < mstime.hoursAgo(8)) {
                    delete this.#sessionDbCache[sessionId];
                    sessionDb.db.close();
                    await Deno.remove(sessionDbFileName);
                }

            }

            if (abortSignal.aborted) {
                break;
            }
        }
    }

    async runSessionDbCopier (abortSignal: AbortSignal, delayMs:number) {
        if (abortSignal.aborted) {
            return;
        }
        await this.copyFromSessionDbs(abortSignal);
        Deno.unrefTimer(setTimeout(() => this.runSessionDbCopier(abortSignal, delayMs).catch(console.error), delayMs));
    }

    async getPaywallFile (forceReload=false) {
        if (this.#paywallFile === undefined || forceReload) {
            const siteDb = this.openSiteDb();
            const fileRow = siteDb.files.fileRow('/paywalls.json');

            if (fileRow === undefined) {
                this.#paywallFile = new PaywallFile();
            } else {
                const pwfPath = this.sitePath.filePath(fileRow.storagePath);
                const pwfText = await Deno.readTextFile(pwfPath);
                this.#paywallFile = PaywallFile.fromJSON(pwfText);
            }
        }
        return this.#paywallFile;
    }

    async runPaywallFileReloader (delayMs:number) {
        await this.getPaywallFile(true);
        Deno.unrefTimer(setTimeout(() => this.runPaywallFileReloader(delayMs).catch(console.error), delayMs));
    }

    async getXPub (forceReload=false) {
        if (this.#xpub === undefined || forceReload) {
            const siteDb = this.openSiteDb();
            const fileRow = siteDb.files.fileRow('/xpub.txt');

            if (fileRow === undefined) {
                this.#xpub = undefined;
            } else {
                const xPubText = await Deno.readTextFile(this.sitePath.filePath(fileRow.storagePath));
                this.#xpub = bsv.Bip32.fromString(xPubText);
            }
        }
        return this.#xpub;
    }

    async runXPubReloader (delayMs:number) {
        await this.getXPub(true);
        Deno.unrefTimer(setTimeout(() => this.runXPubReloader(delayMs).catch(console.error), delayMs));
    }

    closeDbs () {
        this.#siteDb?.db.close();
        this.#countersDb?.db.close();
        for (const [_,value] of Object.entries(this.#sessionDbCache)) {
            value.db.db.close();
        }
    }
}

