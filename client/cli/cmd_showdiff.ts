import * as commander from "npm:commander";

import { SiteMap } from "../sitemap.ts"
import { reindexFiles } from "../reindex.ts";
import { ChangeDetector } from "../changedetector.ts";

import { 
    sitePathOption,
    tryOpenDb,
} from "./helpers.ts"



export const showDiffCmd = new commander.Command('show-diff')
.description('show changes to the files')
.addOption(sitePathOption)
.option('--local','compare filesystem to local db index')
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const siteMap = new SiteMap(sitePath);

    if (options.local) {
        const changeDetector = new ChangeDetector(siteMap, swebDb);
        const changes = await changeDetector.detectChanges();
        
        for (const item of changes.upserts) {
            console.log('new/updated', item.urlPath);
        }

        for (const item of changes.deletions) {
            console.log('deleted', item);
        }

        for (const item of changes.missing) {
            console.log('missing', item.urlPath);
        }

    } else {
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
    }
    swebDb.db.close();
});