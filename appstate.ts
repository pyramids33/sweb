import { ListenOptions } from "/deps/oak/mod.ts";
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

import { PaywallFile } from "/paywallfile.ts";

export interface MapiEndPointInfo {
    name:string,
    url:string,
    extraHeaders: Record<string,string>
}
export interface Config {
    listenOptions: ListenOptions
    cookieSecret: string[]
    env: string
    sitePath: string
    staticPath: string
    domain: string 
    mAPIEndpoints: MapiEndPointInfo[]
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
    #paywallFile?: PaywallFile;
    #apiChannel: BroadcastChannel; 

    constructor (config:Config){
        this.session = {};
        this.config = config;
        this.sitePath = new SitePath(config.sitePath);
        this.#apiChannel = new BroadcastChannel('apiChannel');
        this.#apiChannel.addEventListener('message', (event) => {
            const message:string = event.data; 
            if (message.startsWith('paywallfile')) {
                this.getPaywallFile(true);
            }
        });
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

    getPaywallFile (forceReload=false) : PaywallFile {
        if (this.#paywallFile === undefined || forceReload) {
            const siteDb = this.openSiteDb();
            const jsonString = siteDb.config.getOne('paywallFile');

            if (jsonString) {
                this.#paywallFile = PaywallFile.fromJSON(jsonString);
            } else {
                this.#paywallFile = new PaywallFile();
            }
        }
        return this.#paywallFile;
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

    async unCacheSessionDbs (abortSignal: AbortSignal, delayMs:number) {
        if (abortSignal.aborted) {
            return;
        }
    
        await this.#unCacheSessionDbs();
    
        Deno.unrefTimer(setTimeout(() => 
            this.unCacheSessionDbs(abortSignal, delayMs).catch(console.error), Date.now()+delayMs));
    }

    close () {
        this.#apiChannel.close();
        this.#siteDb?.db.close();
        this.#countersDb?.db.close();
        for (const [_,value] of Object.entries(this.#sessionDbCache)) {
            value.db.db.close();
        }
    }
}