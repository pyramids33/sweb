import  { SwebDbApi } from "/client/database/swebdb.ts";
import { ChangeDetector } from "/client/changedetector.ts";
import { SiteMap } from "/client/sitemap.ts";

export async function reindexFiles (siteMap:SiteMap, swebDb:SwebDbApi) {

    const changeDetector = new ChangeDetector(siteMap, swebDb);
    const results = await changeDetector.detectChanges();
    
    swebDb.db.transaction(function () {
        try {
            for (const file of results.upserts) {
                swebDb.files.local.upsertFile(file);
            }
            for (const urlPath of results.deletions) {
                swebDb.files.local.deleteFile(urlPath);
            }
        } catch (error) {
            if (!swebDb.db.inTransaction) {
                throw error; 
            }
        }
    })(null);

    return results;
}