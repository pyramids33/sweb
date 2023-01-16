import * as commander from "npm:commander";
import { reindexFiles } from "../reindex.ts";
import { SiteMap } from "../sitemap.ts"

import { 
    sitePathOption,
    tryOpenDb,
    validateFormat,
} from "./helpers.ts"


export const showFilesCmd = new commander.Command('show-files')
.addOption(sitePathOption)
.option('--no-reindex', 'skip indexing of local files')
.option('--format <format>', 'output format', validateFormat, 'text')
.description('show site map by walking sitePath')
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath)

    if (options.reindex) {
        const siteMap = new SiteMap(sitePath);
        await reindexFiles(siteMap, swebDb);
    }

    const filesList = swebDb.files.local.listFiles();

    if (options.format === 'text') {
        for (const fileRow of filesList) {
            console.log(fileRow.urlPath, '=>', fileRow.storagePath, fileRow.mimeType, fileRow.size, fileRow.hash.slice(0,4)+'...'+fileRow.hash.slice(-4));
        }
    } else if (options.format === 'json') {
        console.log(JSON.stringify(filesList,null,2));
    }
    swebDb.db.close();
});