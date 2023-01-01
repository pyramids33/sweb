import * as coalesce from '/lib/coalesce.ts'

export interface MatchResult { 
    pattern: string
    spec: PaywallSpec
    match: string 
}

export interface PaywallSpecJSON {
    outputs:PaywallSpecOutputJSON[] 
}

export interface PaywallSpecOutputJSON {
    amount:number
    description?:string
    address?:string  // address or paymail
}

export class PaywallSpec {

    outputs: PaywallSpecOutput[] = []

    constructor () {}

    toObject() : PaywallSpecJSON {
        return { outputs: this.outputs.map(x => x.toObject()) }
    }

    toJSON() {
        return JSON.stringify(this.toObject(), null, 4);
    }

    static fromJSON (jsonString:string) {
        return this.fromObject(JSON.parse(jsonString));
    }

    static fromObject (obj:PaywallSpecJSON) {
        const spec = new this();
        if (obj.outputs && Array.isArray(obj.outputs)) {
            spec.outputs = obj.outputs.map((item) => PaywallSpecOutput.fromObject(item));
        }
        return spec;
    }
}

export class PaywallSpecOutput {

    amount: number
    description?: string
    address?: string 

    constructor (amount:number, description:string|undefined, address:string|undefined) {
        this.description = description;
        this.amount = amount;
        this.address = address;
    }

    toObject() : PaywallSpecOutputJSON {
        return { 
            description: this.description, 
            amount: this.amount, 
            address: this.address
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
            coalesce.string(obj.address, '', 64), 
            coalesce.string(obj.description, '', 64)
        );
    }
}

export function matchSegments (patternSegments:string[], urlPathSegments:string[])  {
    return patternSegments.every((seg:string, i:number) => {
        return i < urlPathSegments.length && seg === urlPathSegments[i] || seg === '*';
    });
}

export class PaywallFile {
    
    paywalls: Record<string,PaywallSpec>

    constructor (
        paywalls: Record<string,PaywallSpec> = {}
    ) {
        this.paywalls = paywalls;
    }

    matchUrl (urlPath:string) : MatchResult|undefined {

        let result:MatchResult|undefined = undefined;

        const urlPathSegments = urlPath.split('/').filter(x => x != '');
        
        for (const [ pattern, spec ] of Object.entries(this.paywalls)) {
            const patternSegments = pattern.split('/').filter(x => x != '');
    
            if (matchSegments(patternSegments, urlPathSegments)) {
                const match = '/'+urlPathSegments.slice(0, patternSegments.length).join('/');
    
                if (result === undefined || match.length > result.match.length) {
                    result = { pattern, spec, match };
                }
            }
        }
    
        return result;
    }

    toObject() : Record<string,PaywallSpec> {
        return this.paywalls;
    }

    toJSON() {
        return JSON.stringify(this.toObject(), null, 4);
    }

    static fromJSON (jsonString:string) {
        return this.fromObject(JSON.parse(jsonString));
    }

    static fromObject (obj:Record<string,PaywallSpec>) {

        const paywalls:Record<string,PaywallSpec> = {};

        for (const [pattern,specJson] of Object.entries(obj)) {
            const spec = PaywallSpec.fromObject(specJson);
            
            if (spec.outputs.length > 0){
                paywalls[pattern] = spec;
            }
        }
        
        return new this(paywalls);
    }
}