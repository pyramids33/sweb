import * as commander from "npm:commander";

import { 
    check200JsonResponse,
    sitePathOption,
    tryGetApiClient,
    tryOpenDb,
} from "./helpers.ts"

export const downloadFileCmd = new commander.Command('download-file')
.description('download a file and pipe to stdout')
.addOption(sitePathOption)
.argument('<urlPath>', 'urlPath of file to download')
.action(async (urlPath, options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const apiClient = tryGetApiClient(swebDb);
    swebDb.db.close();

    const response = await apiClient.downloadFile(urlPath);

    if (!(response.ok && response.body)){
        await check200JsonResponse(response);
        return;
    }
    
    await response.body.pipeTo(Deno.stdout.writable);
});    