import * as commander from "npm:commander";

import { 
    sitePathOption,
    tryOpenDb
} from "./helpers.ts"

export const showBalanceCmd = new commander.Command('show-balance')
.description('show balance summary')
.addOption(sitePathOption)
.action((options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    const rows = swebDb.db.prepare(`select sum(amount) as amount, count(amount) as num from invoiceOutputs where redeemTxHash is null;`).all();
    console.log(rows[0]);
    swebDb.db.close();
});
