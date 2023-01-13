import { ListenOptions } from "/deps/oak/mod.ts";

export type Next = () => Promise<unknown> | unknown;

export interface MapiEndPointInfo {
    name:string,
    url:string,
    extraHeaders: Record<string,string>
}

export interface Config {
    listenOptions: ListenOptions
    workers?: { port:number }[]
    cookieSecret: string[]
    env: string
    logErrors?:boolean
    sitePath: string
    staticPath?: string
    domain: string 
    ensureDirs?: boolean
    initAuthKey?: string
    mAPIEndpoints: MapiEndPointInfo[]
}

