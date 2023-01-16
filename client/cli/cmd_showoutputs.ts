import * as commander from "npm:commander";

import { 
    sitePathOption,
    tryOpenDb,
} from "./helpers.ts"


export const showOutputsCmd = new commander.Command('show-outputs')
.description('show txoutputs')
.addOption(sitePathOption)
.action((options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);
    console.log(swebDb.db.prepare('select * from invoiceOutputs order by invoiceRef,invTxOutNum').all())
    swebDb.db.close();
});