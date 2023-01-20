import * as commander from "npm:commander";

import { SiteMap } from "../sitemap.ts"

import { 
    check200JsonResponse,
    sitePathOption,
    ServerFileRow,
    tryGetApiClient,
    tryOpenDb
} from "./helpers.ts"

import { reindexFiles } from "../reindex.ts";


export const reindexFilesCmd = new commander.Command('reindex-files')
.addOption(sitePathOption)
.option('-l --local', 'updates the db index with changes to the local files')
.option('-f --full', 'full reindex of the local files')
.option('-s --server', 'get current file list from server')
.description('Reindex file information')
.action(async (options) => {
    const sitePath = options.sitePath;
    const siteMap = new SiteMap(sitePath);
    const swebDb = tryOpenDb(sitePath)

    if (options.local) {

        if (options.full) {
            swebDb.files.local.deleteAll();
        }

        const changes = await reindexFiles(siteMap, swebDb);
        
        for (const item of changes.upserts) {
            console.log('new/updated', item.urlPath);
        }

        for (const item of changes.deletions) {
            console.log('deleted', item);
        }

        for (const item of changes.missing) {
            console.log('missing', item.urlPath);
        }
    }

    if (options.server) {
        const apiClient = tryGetApiClient(swebDb);
        const response = await apiClient.searchFiles()
        const responseObj = await check200JsonResponse(response);
        
        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        swebDb.db.transaction(function () {
            swebDb.files.server.deleteAll();
            for (const f of responseObj as ServerFileRow[]) {
                swebDb.files.server.upsertFile(f);
            }
        })(null);

        console.log('server', responseObj);
    }
    swebDb.db.close();
});