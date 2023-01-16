import * as commander from "npm:commander";

import { 
    check200JsonResponse,
    sitePathOption,
    tryGetApiClient,
    tryOpenDb,
} from "./helpers.ts"

export const activateAuthKeyCmd = new commander.Command('activate-authkey')
.description('activate authKey on the server using the DNS txt record')
.addOption(sitePathOption)
.action(async (options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const apiClient = tryGetApiClient(swebDb);
    const response = await apiClient.dnsAuth();
    const responseObj = await check200JsonResponse(response);

    if (responseObj.error) {
        console.error(responseObj);
        Deno.exit(1);
    }

    swebDb.db.close();
});
