import * as commander from "npm:commander";


import { 
    check200JsonResponse,
    sitePathOption,
    tryGetApiClient,
    tryOpenDb,
} from "./helpers.ts"


export const getFileInfoCmd = new commander.Command('get-fileinfo')
.description('get info about a file ')   
.argument('<urlPath>', 'urlPath of file ')
.addOption(sitePathOption)
.action(async (urlPath, options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const apiClient = tryGetApiClient(swebDb);
    swebDb.db.close();

    const response = await apiClient.getFileInfo(urlPath)
    const responseObj = await check200JsonResponse(response);

    if (responseObj.error) {
        console.error(responseObj);
        Deno.exit(1);
    }

    console.log(responseObj);
});   

