import * as commander from "npm:commander";

import { 
    sitePathOption,
    tryOpenDb
} from "./helpers.ts"

export const showPaymentsCmd = new commander.Command('show-payments')
.description('show payments')
.addOption(sitePathOption)
.action((options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    console.log(swebDb.db.prepare('select ref,created,domain,urlPath,subtotal,paidAt,paymentMethod,txid from invoices order by ref').all())
    swebDb.db.close();
});
