import * as path from "/deps/std/path/mod.ts";

export class SitePath {

    rootPath:string;
    filesPath:string;
    siteDbPath:string;
    countersDbPath:string;

    constructor (rootPath:string) {
        this.rootPath = rootPath;
        this.filesPath = path.join(rootPath, 'files');
        this.siteDbPath = path.join(rootPath, 'site.db');
        this.countersDbPath = path.join(rootPath, 'counters.db');
    }

    filePath (filePath:string) : string {
        return path.join(this.filesPath, filePath||'');
    }

    filePathRelative (filePath:string) : string {
        return path.join(this.filesPath, filePath||'').slice(this.rootPath.length);
    }

    sessionDbPath(sessionId:string) {
        return path.join(this.rootPath, 'sessions', sessionId + '.db');
    }
}
