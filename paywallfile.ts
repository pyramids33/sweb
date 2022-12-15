import bsv from "npm:bsv";
import * as coalesce from '/coalesce.ts'

interface MatchResult { 
    paywall: PaywallSpec
    match: string 
}

interface XPubInfo {
    xpubstr: string
    xpub: bsv.Bip32
}

interface PaywallFileJSON {
    xpubs: Record<string,string>
    paywalls: PaywallSpecJSON[]
}

interface PaywallSpecJSON {
    pattern:string
    outputs:PaywallSpecOutputJSON[] 
}

interface PaywallSpecOutputJSON {
    amount:number
    xpubname:string
    description?:string
}

class PaywallSpec {

    pattern = ''
    outputs: PaywallSpecOutput[] = []

    constructor (pattern?:string) {
        if (pattern !== undefined) {
            this.pattern = pattern;
        }
    }

    toObject() : PaywallSpecJSON {
        return { pattern: this.pattern, outputs: this.outputs.map(x => x.toObject()) }
    }

    toJSON() {
        return JSON.stringify(this.toObject(), null, 4);
    }

    static fromJSON (jsonString:string) {
        return this.fromObject(JSON.parse(jsonString));
    }

    static fromObject (obj:PaywallSpecJSON) {
        const spec = new this(obj.pattern);
        if (obj.outputs && Array.isArray(obj.outputs)) {
            spec.outputs = obj.outputs.map((item) => PaywallSpecOutput.fromObject(item));
        }
        return spec;
    }
}

class PaywallSpecOutput {

    description?: string
    amount: number
    xpubname: string 

    constructor (amount:number, xpubname:string, description:string|undefined) {
        this.description = description;
        this.amount = amount;
        this.xpubname = xpubname;
    }

    toObject() : PaywallSpecOutputJSON {
        return { 
            description: this.description, 
            amount: this.amount, 
            xpubname: this.xpubname 
        }
    }

    toJSON() {
        return JSON.stringify(this.toObject(), null, 4);
    }

    static fromJSON (jsonString:string) {
        return this.fromObject(JSON.parse(jsonString));
    }

    static fromObject (obj:PaywallSpecOutputJSON) {
        return new this(
            coalesce.number(obj.amount, 0, 10), 
            coalesce.string(obj.xpubname, '', 64), 
            coalesce.string(obj.description, '', 64)
        );
    }
}

function matchSegments (patternSegments:string[], urlPathSegments:string[])  {
    return patternSegments.every((seg:string, i:number) => {
        return i < urlPathSegments.length && seg === urlPathSegments[i] || seg === '*';
    });
}

export class PaywallFile {
    
    xpubs: Record<string, XPubInfo>
    paywalls: PaywallSpec[]

    constructor (
        xpubs: Record<string, XPubInfo> = {}, 
        paywalls: PaywallSpec[] = []
    ) {
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

    toObject() : PaywallFileJSON {
        const obj:PaywallFileJSON = { xpubs: {}, paywalls: this.paywalls.map(x => x.toObject()) };

        Object.entries(this.xpubs).forEach(([name,info]) => obj.xpubs[name] = info.xpubstr);

        return obj;
    }

    toJSON() {
        return JSON.stringify(this.toObject(), null, 4);
    }

    static fromJSON (jsonString:string) {
        return this.fromObject(JSON.parse(jsonString));
    }

    static fromObject (obj:PaywallFileJSON) {

        const xpubs:Record<string, XPubInfo> = {};
        
        if (typeof(obj.xpubs) === 'object') {
            for (const [name, xpubstr] of Object.entries(obj.xpubs)) {
                try {
                    xpubs[name] = { xpubstr, xpub: bsv.Bip32.fromString(xpubstr) };
                } catch { /***/ }
            }
        }

        const paywalls:PaywallSpec[] = [];

        if (Array.isArray(obj.paywalls)) {
            for (const item of obj.paywalls) {
                const spec = PaywallSpec.fromObject(item);
                spec.outputs = spec.outputs.filter((item) => xpubs[item.xpubname])
                
                if (spec.outputs.length > 0){
                    paywalls.push(spec);
                }
            }
        }

        return new this(xpubs, paywalls);
    }
}