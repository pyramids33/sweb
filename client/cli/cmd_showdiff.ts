import * as commander from "npm:commander";

import { SiteMap } from "../sitemap.ts"


import { 
    sitePathOption,
    tryOpenDb,
} from "./helpers.ts"

import { reindexFiles } from "../reindex.ts";

export const showDiffCmd = new commander.Command('show-diff')
.description('Compare local files to server files. (performs local reindex)')
.addOption(sitePathOption)
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const siteMap = new SiteMap(sitePath);
    await reindexFiles(siteMap, swebDb);

    const { deletions, renames, uploads } = swebDb.files.compareLocalToServer();

    for (const item of deletions) {
        console.log('delete', item.urlPath);
    }
    for (const item of renames) {
        console.log('rename', item.server.urlPath, item.local.urlPath);
    }
    for (const item of uploads) {
        console.log('upload', item.urlPath);
    }
    swebDb.db.close();
});