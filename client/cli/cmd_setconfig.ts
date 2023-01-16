import * as commander from "npm:commander";

import { 
    configOptions,
    sitePathOption,
    tryOpenDb,
} from "./helpers.ts"

export const setConfigCmd = new commander.Command('set-config')
.addOption(sitePathOption)
.addOption(configOptions.siteUrl)
.addOption(configOptions.authKey)
.option('--no-siteUrl', 'remove siteUrl config')
.option('--no-authKey', 'remove authKey config')
.description('Set configuration options')
.action((options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath);

    for (const name of ['authKey','siteUrl']) {
        const key = '$.config.'+name;

        if (options[name]) {
            swebDb.meta.setValue(key, options[name]||null);
        }

        if (options[name] === false) {
            swebDb.meta.removeValue(key);
        }
    }
    swebDb.db.close();
});