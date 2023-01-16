import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";

import { PaywallFile } from "/lib/paywallfile.ts";

import { 
    sitePathOption,
    getPaywallFile
} from "./helpers.ts"


export const addPaywallCmd = new commander.Command('add-paywall')
.description('add paywall')
.addOption(sitePathOption)
.argument('<pattern>', 'pattern')
.argument('<amount>', 'payment amount (SATs)')
.argument('[description]', 'reason for payment etc')
.argument('[address]', 'address or paymail')
.action((pattern, amount, description, address, options) => {
    const sitePath = options.sitePath;
    const output = PaywallFile.ObjectToPaywallOutput({ amount, description, address });
    
    if (output.amount < 0) {
        throw new Error('invalid amount, must be integer > 0')
    }

    const paywallFile = getPaywallFile(sitePath);
    const spec = paywallFile.getPaywall(pattern);
    
    if (spec === undefined) {
        if (output.amount > 0) {
            paywallFile.addPaywall(pattern, { outputs: [ output ] });
        }
    } else {
        if (output.amount > 0) {
            spec.outputs = spec.outputs || [];
            spec.outputs.push(output);
        }
    }
    Deno.writeTextFileSync(path.join(sitePath,'paywalls.json'), JSON.stringify(paywallFile, null, 2));
});