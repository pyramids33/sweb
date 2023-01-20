import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";
import * as mime from "/deps/std/media_types/mod.ts";

import { tryStat } from "/lib/trystat.ts";
import { hashFile } from "/lib/hash.ts";

import { 
    check200JsonResponse,
    tryGetApiClient,
    tryOpenDb,
} from "./helpers.ts"

import { SiteMap } from "/client/sitemap.ts";

export const uploadFileCmd = new commander.Command('upload-file')
.description('upload a file')
.argument('<relativePath>', 'file path relative to the sitePath')
.action(async (relativePath, _options, cmd) => {
    const sitePath = cmd.parent.opts().sitePath;
    const swebDb = tryOpenDb(sitePath);
    const apiClient = tryGetApiClient(swebDb);

    const siteMap = new SiteMap(sitePath);
    const fileInfo = await siteMap.fileInfo(relativePath);
    
    if (fileInfo === undefined) {
        console.error('invalid file path');
        swebDb.db.close();
        Deno.exit(1);
    }

    const filePath = path.join(sitePath, fileInfo.storagePath);
    const stat = await tryStat(filePath);

    if (stat === undefined) {
        console.error('invalid file path');
        swebDb.db.close();
        Deno.exit(1);
    }

    const size = stat.size;    
    const hash = await hashFile('sha256', filePath, 'hex')
    const mimeType = mime.contentType(path.extname(fileInfo.urlPath)) || 'application/octet-stream';
    
    const response = await apiClient.uploadFile(filePath, fileInfo.urlPath, hash, size, mimeType);
    const responseObj = await check200JsonResponse(response);

    if (responseObj.error) {
        console.error(responseObj);
        swebDb.db.close();
        Deno.exit(1);
    }

    swebDb.files.server.upsertFile({ urlPath: fileInfo.urlPath, hash, size, mimeType });
    swebDb.db.close();
});    
