import * as commander from "npm:commander";

import { 
    sitePathOption,
    getPaywallFile
} from "./helpers.ts"


export const showPaywallsCmd = new commander.Command('show-paywalls')
.description('show the paywalls from paywall.json')
.addOption(sitePathOption)
.action((_options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    const paywallFile = getPaywallFile(sitePath);

    console.log('paywalls: ');
    for (const [ pattern, spec ] of Object.entries(paywallFile.toJSON())) {
        console.log('  '+pattern);
        for (const [id,output] of spec.outputs.entries()) {
            console.log('    ' + (id + 1) + ': ', output.amount, output.description, output.address);
        }
    }
});

