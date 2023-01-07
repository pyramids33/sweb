import * as commander from "npm:commander";
import * as path from "/deps/std/path/mod.ts";

import { PaywallFile } from "/lib/paywallfile.ts";
import { getPaywallFile } from "./cli_helpers.ts";

export const paywallsCmd = new commander.Command('paywalls')
    .description('Configure the site paywalls');

paywallsCmd.command('add')
.description('add paywall')
.argument('<pattern>', 'pattern')
.argument('<amount>', 'payment amount (SATs)')
.argument('[description]', 'reason for payment etc')
.argument('[address]', 'address or paymail')
.action((pattern, amount, description, address, _options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
    
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

paywallsCmd.command('remove')
.description('remove paywall or paywall output')
.argument('<pattern>', 'pattern')
.argument('<outputNum>', 'output number or `a` to remove all ')
.action((pattern, outputNum, _options, cmd) => {
    const sitePath = cmd.parent.parent.opts().sitePath;
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


paywallsCmd.command('show')
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
