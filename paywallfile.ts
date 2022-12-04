import bsv from "npm:bsv";

interface PaywallSpecOutput {
    description: string
    amount: number
    xpubname: string 
}

interface PaywallSpec {
    pattern: string
    outputs: PaywallSpecOutput[]
}

interface MatchResult { 
    paywall:PaywallSpec
    match:string 
}

function matchSegments (patternSegments:string[], urlPathSegments:string[])  {
    return patternSegments.every((seg:string, i:number) => i < urlPathSegments.length && seg === urlPathSegments[i] || seg === '*')
}

export class PaywallFile {
    
    xpubs: Record<string, bsv.Bip32>
    paywalls: PaywallSpec[]

    constructor (xpubs: Record<string, bsv.Bip32>={}, paywalls: PaywallSpec[]=[]) {
        this.xpubs = xpubs;
        this.paywalls = paywalls;
    }

    matchUrl (urlPath:string) : MatchResult|undefined {
        let result:MatchResult|undefined = undefined;
        const urlPathSegments = urlPath.split('/').filter(x => x != '');
        
        for (const paywall of this.paywalls) {
            const patternSegments = paywall.pattern.split('/').filter(x => x != '');
    
            if (matchSegments(patternSegments, urlPathSegments)) {
                const match = '/'+urlPathSegments.slice(0, patternSegments.length).join('/');
    
                if (result === undefined || match.length > result.match.length) {
                    result = { paywall, match };
                }
            }
        }
    
        return result;
    }

    toObject() {
        return { xpubs: this.xpubs, paywalls: this.paywalls };
    }

    toJSON() {
        return JSON.stringify(this.toObject(), null, 4);
    }

    static fromJSON (jsonString:string) {
        return this.fromObject(JSON.parse(jsonString));
    }

    static fromObject (obj:Record<string,unknown>) {
        
        const xpubs:Record<string, bsv.Bip32> = {};
        const paywalls:PaywallSpec[] = [];

        if (obj.xpubs && typeof(obj.xpubs) === 'object') {
            for (const [name,xpub] of Object.entries(obj.xpubs)) {
                xpubs[name] = bsv.Bip32.fromString(xpub);
            }
        }

        if (obj.paywalls && Array.isArray(obj.paywalls)) {
            for (const item of obj.paywalls) {
                const spec:PaywallSpec = { pattern: item.pattern, outputs: [] };

                if (item.outputs && Array.isArray(item.outputs)) {
                    for (const itemOutput of item.outputs) {
                        const specOutput:PaywallSpecOutput = {
                            amount: typeof(itemOutput.amount) === 'number' ? Math.floor(itemOutput.amount).toFixed(0) : itemOutput.amount,
                            description : typeof(itemOutput.description) === 'string' ? itemOutput.description.slice(0,64) : '',
                            xpubname: typeof(itemOutput.xpubname) === 'string' ? itemOutput.xpubname.slice(0,64) : '',
                        }
                        if (xpubs[specOutput.xpubname]) {
                            spec.outputs.push(specOutput);
                        }
                    }
                }
                if (spec.outputs.length > 0){
                    paywalls.push(spec);
                }
            }
        }
        return new this(xpubs, paywalls);
    }
}