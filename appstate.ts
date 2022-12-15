import { delay } from "/deps/std/async/mod.ts";

import { DatabaseOpenOptions } from "/deps/sqlite3/mod.ts";

import { openDb } from "/database/mod.ts";

import CountersDbModule from "/database/countersdb.ts";
import type { CountersDbApi } from "/database/countersdb.ts";

import SiteDbModule from "/database/sitedb.ts";
import type { SiteDbApi } from "/database/sitedb.ts";

import SessionDbModule from "/database/sessiondb.ts";
import type { SessionDbApi } from "/database/sessiondb.ts";

import { SitePath } from "/sitepath.ts";
import mstime from "/mstime.ts";
import * as path from "/deps/std/path/mod.ts";

import { PaywallFile } from "/paywallfile.ts";
import { Config } from "/types.ts";
import { SSECache } from "/ssecache.ts";
import { Session } from "/middleware/session.ts";

interface SessionDbCacheEntry {
    db: SessionDbApi,
    lastAccess: number
}

export class AppState {

    session: Session = {}
    config: Config
    sitePath: SitePath
    workerId = 0

    sse:SSECache = new SSECache()
    #siteDb?: SiteDbApi
    #countersDb?: CountersDbApi
    #sessionDbCache: Record<string, SessionDbCacheEntry> = {};
    #paywallFile?: PaywallFile;

    constructor (config:Config){
        this.config = config;
        this.sitePath = new SitePath(config.sitePath);
    }

    openCountersDb () : CountersDbApi {
        if (this.#countersDb === undefined) {
            this.#countersDb = openDb<CountersDbApi>(CountersDbModule, this.sitePath.countersDbPath(this.workerId));
        }
        return this.#countersDb;
    }

    openSiteDb () : SiteDbApi {
        if (this.#siteDb === undefined) {
            this.#siteDb = openDb<SiteDbApi>(SiteDbModule, this.sitePath.siteDbPath);
        }
        return this.#siteDb;
    }

    openSessionDb (sessionId:string, options?:DatabaseOpenOptions) : SessionDbApi {
        if (this.#sessionDbCache[sessionId]) {
            this.#sessionDbCache[sessionId].lastAccess = Date.now();
            return this.#sessionDbCache[sessionId].db;
        }

        const db = openDb<SessionDbApi>(SessionDbModule, this.sitePath.sessionDbPath(sessionId), options);
        this.#sessionDbCache[sessionId] = { db, lastAccess: Date.now() };
        return db;
    }

    async #unCacheSessionDbs () {

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
        console.log('M/ unCacheSessionDbs');
        await this.#unCacheSessionDbs();
        Deno.unrefTimer(setTimeout(() => this.runSessionDbUncacher(abortSignal, delayMs).catch(console.error), delayMs));
    }

    async #copyFromSessionDbs (abortSignal:AbortSignal) {

        const siteDb = this.openSiteDb();
        const dirEntries = Deno.readDir(this.sitePath.sessionDbsPath);

        for await (const dirEnt of dirEntries) {

            if (dirEnt.isFile && dirEnt.name.endsWith('.db')) {

                const dbFileName = path.join(this.sitePath.sessionDbsPath, dirEnt.name);

                try {
                    siteDb.attachSessionDb(dbFileName);
                    siteDb.copyFromSessionDb();
                    const sessionCheckIn = siteDb.getSessionDbCheckIn();
                    siteDb.detachSessionDb();
                    
                    /* If the session has not checked in for 8 hours, the cookie must be expired */
                    if (sessionCheckIn < mstime.hoursAgo(8)) {
                        await Deno.remove(dbFileName);
                    }

                } catch (error) {
                    console.error(error);
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
        console.log('M/ copyFromSessionDbs');
        await this.#copyFromSessionDbs(abortSignal);
        Deno.unrefTimer(setTimeout(() => this.runSessionDbCopier(abortSignal, delayMs).catch(console.error), delayMs));
    }

    getPaywallFile (forceReload=false) : PaywallFile {
        if (this.#paywallFile === undefined || forceReload) {
            const siteDb = this.openSiteDb();
            const jsonString = siteDb.config.getOne('paywalls');

            if (jsonString) {
                this.#paywallFile = PaywallFile.fromJSON(jsonString);
            } else {
                this.#paywallFile = new PaywallFile();
            }
        }
        return this.#paywallFile;
    }

    runPaywallFileReloader (delayMs:number) {
        console.log('M/ getPaywallFile');
        this.getPaywallFile(true);
        Deno.unrefTimer(setTimeout(() => this.runPaywallFileReloader(delayMs), delayMs));
    }

    close () {
        this.#siteDb?.db.close();
        this.#countersDb?.db.close();
        for (const [_,value] of Object.entries(this.#sessionDbCache)) {
            value.db.db.close();
        }
        this.sse.close();
    }
}

