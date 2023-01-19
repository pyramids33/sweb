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
    const rows = swebDb.db.prepare(`
        select ref,created,domain,urlPath,subtotal,paidAt,paymentMethod,txid 
        from invoices 
        order by ref
    `).all().map(x => { return {
        ...x,
        paidAt: x.paidAt ? new Date(x.paidAt) : x.paidAt,
        created: x.created ? new Date(x.created) : x.created
    }});
    console.log(rows);
    swebDb.db.close();
});
