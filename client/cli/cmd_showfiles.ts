import * as commander from "npm:commander";
import { SiteMap } from "../sitemap.ts"

import { 
    sitePathOption,
    tryOpenDb,
    validateFormat,
} from "./helpers.ts"


export const showFilesCmd = new commander.Command('show-files')
.addOption(sitePathOption)
.option('--fs', 'walk the filesystem')
.option('--db', 'show the db index of the files')
.option('--format <format>', 'output format', validateFormat, 'text')
.description('show site map by walking sitePath')
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath)

    if (options.fs) {
        
        const siteMap = new SiteMap(sitePath);

        if (options.format === 'text') {

            for await (const siteMapEntry of siteMap.walk()) {
                console.log(`"${siteMapEntry.urlPath}","${siteMapEntry.storagePath}","${siteMapEntry.mimeType}"`);
            }

        } else if (options.format === 'json') {

            const filesList:{ urlPath:string, storagePath:string, mimeType:string }[] = [];
            
            for await (const siteMapEntry of siteMap.walk()) {
                filesList.push({ 
                    urlPath: siteMapEntry.urlPath, 
                    storagePath: siteMapEntry.storagePath, 
                    mimeType: siteMapEntry.mimeType 
                });    
            }

            console.log(JSON.stringify(filesList,null,2));
        }
    }

    if (options.db) {
        const filesList = swebDb.files.local.listFiles();

        if (options.format === 'text') {
            for (const fileRow of filesList) {
                console.log(`"${fileRow.urlPath}","${fileRow.storagePath}","${fileRow.mimeType}","${fileRow.size}","${fileRow.hash}"`)
            }
        } else if (options.format === 'json') {
            console.log(JSON.stringify(filesList,null,2));
        }
    }

    swebDb.db.close();
});