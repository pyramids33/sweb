import { ListenOptions } from "/deps/oak/mod.ts";

import { openDb } from "/database/mod.ts";

import CountersDbModule from "/database/countersdb.ts";
import type { CountersDbApi } from "/database/countersdb.ts";

import SiteDbModule from "/database/sitedb.ts";
import type { SiteDbApi } from "/database/sitedb.ts";

import SessionDbModule from "/database/sessiondb.ts";
import type { SessionDbApi } from "/database/sessiondb.ts";

import { SitePath } from "/site_path.ts";
import mstime from "/mstime.ts";
import sleep from "/sleep.ts";

export interface Config {
    listenOptions: ListenOptions,
    cookieSecret: string[],
    env: string,
    sitePath: string,
    staticPath: string
}

export interface Session {
    sessionId?: string,
    createTime?: number
    visitTime?: number
}

interface SessionDbCacheEntry {
    db: SessionDbApi,
    lastAccess: number
}

export class AppState {

    session: Session
    config: Config
    sitePath: SitePath

    #siteDb?: SiteDbApi
    #countersDb?: CountersDbApi
    #sessionDbCache: Record<string, SessionDbCacheEntry> = {};

    constructor (config:Config){
        this.session = {};
        this.config = config;
        this.sitePath = new SitePath(config.sitePath);
    }

    openCountersDb () : CountersDbApi {
        if (this.#countersDb === undefined) {
            this.#countersDb = openDb<CountersDbApi>(CountersDbModule, this.sitePath.countersDbPath);
        }
        return this.#countersDb;
    }

    openSiteDb () : SiteDbApi {
        if (this.#siteDb === undefined) {
            this.#siteDb = openDb<SiteDbApi>(SiteDbModule, this.sitePath.siteDbPath);
        }
        return this.#siteDb;
    }

    openSessionDb (sessionId:string) : SessionDbApi {
        if (this.#sessionDbCache[sessionId]) {
            this.#sessionDbCache[sessionId].lastAccess = Date.now();
            return this.#sessionDbCache[sessionId].db;
        }

        const db = openDb<SessionDbApi>(SessionDbModule, this.sitePath.sessionDbPath(sessionId));
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

            await sleep(0);
        }
    }

    async unCacheSessionDbs (abortSignal: AbortSignal, delayMs:number) {
        if (abortSignal.aborted) {
            return;
        }
    
        await this.#unCacheSessionDbs();
    
        Deno.unrefTimer(setTimeout(() => 
            this.unCacheSessionDbs(abortSignal, delayMs).catch(console.error), Date.now()+delayMs));
    }
}