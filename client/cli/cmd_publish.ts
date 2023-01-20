import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";

import { SiteMap } from "../sitemap.ts"
import { reindexFiles } from "../reindex.ts";

import { 
    check200JsonResponse,
    sitePathOption,
    tryGetApiClient,
    tryOpenDb
} from "./helpers.ts"


export const publishCmd = new commander.Command('publish')
.description('Sync files to server. (Local reindex, diff, then upload/delete/rename)')
.addOption(sitePathOption)
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const siteMap = new SiteMap(sitePath);
    
    console.log('reindexing...');
    await reindexFiles(siteMap, swebDb);

    console.log('comparing...');
    const apiClient = tryGetApiClient(swebDb);
    
    const { deletions, renames, uploads } = swebDb.files.compareLocalToServer();

    {
        console.log('deletions... ' + deletions.length.toString());
        const deleteList = deletions.map(x => x.urlPath);
        const response = await apiClient.deleteFiles(deleteList.join('\n'));
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        swebDb.files.server.deleteList(...deleteList);
    }

    {
        console.log('renames... ' + renames.length.toString());
        const renameList = renames.map(x => [ x.server.urlPath, x.local.urlPath ] as [string,string]);
        const response = await apiClient.renameFiles(renameList.map(x => x.join('\n')).join('\n'));
        const responseObj = await check200JsonResponse(response);

        if (responseObj.error) {
            console.error(responseObj);
            Deno.exit(1);
        }

        swebDb.files.server.renameList(renameList);
    }

    {
        console.log('uploads... ' + uploads.length.toString());
        for (const item of uploads) {
            const { urlPath, hash, size, storagePath, mimeType } = item;
            const cwdRelativePath = path.join(sitePath, storagePath);
            console.log('uploading... ' + urlPath)
            const response = await apiClient.uploadFile(cwdRelativePath, urlPath, hash, size, mimeType);
            const responseObj = await check200JsonResponse(response);

            if (responseObj.error) {
                console.error(responseObj);
                Deno.exit(1);
            }

            swebDb.files.server.upsertFile(item);
        }
    }
    swebDb.db.close();
});
