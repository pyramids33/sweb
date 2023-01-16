import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";

import { 
    sitePathOption,
    getPaywallFile
} from "./helpers.ts"

export const removePaywallCmd = new commander.Command('remove-paywall')
.description('remove paywall or paywall output')
.addOption(sitePathOption)
.argument('<pattern>', 'pattern')
.argument('<outputNum>', 'output number or `a` to remove all ')
.action((pattern, outputNum, options) => {
    const sitePath = options.sitePath;
    const paywallFile = getPaywallFile(sitePath);
    const spec = paywallFile.getPaywall(pattern);

    if (spec && spec.outputs) {
        if (outputNum === 'a') {
            delete spec.outputs;
        } else {
            const outputNumInt = parseInt(outputNum);
            
            if (outputNumInt > 0 && outputNumInt <= spec.outputs.length) {
                spec.outputs.splice(outputNum-1, 1)
            }

            if (spec.outputs.length === 0) {
                delete spec.outputs;
            }
        }
    }

    Deno.writeTextFileSync(path.join(sitePath,'paywalls.json'), JSON.stringify(paywallFile, null, 2));
});
