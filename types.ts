import { ListenOptions } from "/deps/oak/mod.ts";

export interface Config {
    listenOptions: ListenOptions,
    siteDir: string,
    cookieSecret: string[],
    env: string,
    staticPath: string
}

export interface Session {
    token: string,
    tokenTime?: number
    visitTime?: number
}

export interface AppState {
    session: Session,
    config: Config
}