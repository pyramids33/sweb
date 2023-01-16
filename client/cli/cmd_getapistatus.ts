import * as commander from "npm:commander";

import { 
    check200JsonResponse,
    sitePathOption,
    tryGetApiClient,
    tryOpenDb
} from "./helpers.ts"


export const getApiStatusCmd = new commander.Command('get-api-status')
.description('ping the server to check online and authorized')
.addOption(sitePathOption)
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const apiClient = tryGetApiClient(swebDb);
    const response = await apiClient.status();
    const responseObj = await check200JsonResponse(response);

    if (responseObj.error) {
        console.error(responseObj);
        Deno.exit(1);
    }
    console.log('OK');
    swebDb.db.close();
});