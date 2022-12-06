import * as path from "/deps/std/path/mod.ts";
import { ensureDir } from "/deps/std/fs/ensure_dir.ts";

export class SitePath {

    rootPath:string;
    filesPath:string;
    sessionDbsPath:string;
    siteDbPath:string;
    countersDbPath:string;

    constructor (rootPath:string) {
        this.rootPath = rootPath;
        this.filesPath = path.join(rootPath, 'files');
        this.sessionDbsPath = path.join(rootPath, 'sessions');
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
        return path.join(this.sessionDbsPath, sessionId + '.db');
    }

    async ensureDirs () {
        await ensureDir(this.rootPath);
        await ensureDir(this.filesPath);
        await ensureDir(this.sessionDbsPath);
    }
}
