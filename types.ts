import { ListenOptions } from "/deps/oak/mod.ts";

export type Next = () => Promise<unknown> | unknown;

export interface MapiEndPointInfo {
    name:string,
    url:string,
    extraHeaders: Record<string,string>
}

export interface Config {
    workerId:number
    listenOptions: ListenOptions
    workers?: { workerId:number, port:number }[]
    cookieSecret: string[]
    env: string
    sitePath: string
    staticPath: string
    domain: string 
    ensureDirs?: boolean
    initAuthKey?: string
    mAPIEndpoints: MapiEndPointInfo[]
}

