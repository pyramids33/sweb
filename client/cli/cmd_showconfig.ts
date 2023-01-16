import * as commander from "npm:commander";

import { 
    sitePathOption,
    tryOpenDb,
} from "./helpers.ts"


export const showConfigCmd = new commander.Command('show-config')
.addOption(sitePathOption)
.option('-n, --names <names...>', 'specify names, or dont to show all')
.description('show config from db')
.action((options) => {
    const sitePath = options.sitePath;
    const swebDb = tryOpenDb(sitePath)
    
    console.log('config: '+sitePath)
    
    const config = swebDb.getConfig();
    
    for(const [name,value] of Object.entries(config)) {
        if (options.names === undefined || options.names?.includes(name)) {
            console.log('  '+name,'=',value);
        }
    }
    swebDb.db.close();
});

