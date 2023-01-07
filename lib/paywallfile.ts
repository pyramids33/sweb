import * as coalesce from '/lib/coalesce.ts'

export interface MatchResult { 
    pattern: string
    match: string 
    spec: { 
        outputs: PaywallOutput[] 
    }
}

export interface PaywallNode {
    outputs?:PaywallOutput[]
    "/"?: Record<string,PaywallNode>
}

export interface PaywallSpec { 
    outputs: PaywallOutput[] 
}

export interface PaywallOutput {
    amount:number
    description?:string
    address?:string  // address or paymail
}

export class PaywallFile {
    
    paywalls:Record<string,PaywallNode> = {}

    constructor () {}

    matchUrl (urlPath:string) : MatchResult|undefined {
        const segments = urlPath.slice(1).split('/');
        let node:PaywallNode = { "/": this.paywalls };
        const match = [];
        const pattern = [];

        for (const segment of segments) {

            if (node["/"] === undefined) {
                break;
            } else if (node["/"][segment]) {

                node = node["/"][segment];
                match.push(segment);
                pattern.push(segment);

            } else if (node["/"]['*']) {

                node = node["/"]['*'];
                match.push(segment);
                pattern.push('*');

            } else {
                break;
            }
        }

        if (match.length === 0 || node.outputs == undefined || node.outputs.length === 0) {
            return undefined;
        }

        return {
            match: '/' + match.join('/') + (urlPath.endsWith('/') ? '/' : ''),
            pattern: '/' + pattern.join('/'),
            spec: { outputs: node.outputs }
        }
    }

    addPaywall (pattern:string, spec:PaywallSpec) {
        if (spec.outputs === undefined || spec.outputs.length === 0) {
            return;
        }

        const segments = pattern.split('/');
        
        let node:PaywallNode = { "/": this.paywalls };
        
        for (const segment of segments) {
            if (segment === '') {
                continue;
            }
            if (node["/"] === undefined) {
                node["/"] = {};
            }
            if (node["/"][segment] === undefined) {
                node["/"][segment] = {}
            }
            node = node["/"][segment];
        }

        node.outputs = spec.outputs;
    }

    getPaywall (pattern:string) {
        const segments = pattern.split('/');
        
        let node:PaywallNode = { "/": this.paywalls };

        for (const segment of segments) {
            if (segment === '') {
                continue;
            }
            if (node["/"] === undefined) {
                return undefined;
            }
            if (node["/"][segment] === undefined) {
                return undefined;
            }
            node = node["/"][segment];
        }

        return node;
    }

    *#recursePaywalls (node:PaywallNode, pattern:string) : Generator<{pattern:string, spec:PaywallSpec}> {
        if (node.outputs && node.outputs.length) {
            yield { pattern, spec: { outputs: node.outputs } };
        }

        if (node["/"]) {
            for (const [ seg, cnode ] of Object.entries(node["/"])) {
                yield* this.#recursePaywalls(cnode, pattern+'/'+seg);
            }
        }
    }

    *recursePaywalls () : Generator<{pattern:string, spec:PaywallSpec}> {
        yield* this.#recursePaywalls({ "/": this.paywalls },'');
    }

    toJSON () {
        const obj: Record<string, PaywallSpec> = {};
        for (const { pattern, spec } of this.recursePaywalls()) {
            obj[pattern] = spec;
        }
        return obj;
    }

    static fromJSON (obj:unknown|string) : PaywallFile {
        
        if (typeof(obj) === 'string') {
            return this.fromJSON(JSON.parse(obj));
        }

        const pwf = new this();

        if (obj) {
            for (const [pattern, spec] of Object.entries(obj)) {

                const outputs:PaywallOutput[] = [];

                if (spec.outputs && Array.isArray(spec.outputs)) {
                    for (const output of spec.outputs) {
                        if (output.amount) {
                            outputs.push(this.ObjectToPaywallOutput(output));
                        }
                    }
                }

                pwf.addPaywall(pattern, { outputs });
            }
        }

        return pwf;
    }

    static ObjectToPaywallOutput (obj:Record<string,unknown>) : PaywallOutput {
        return {
            amount: coalesce.safeInt(obj?.amount, 0, 10), 
            address: coalesce.string(obj?.address, undefined, 64), 
            description: coalesce.string(obj?.description, undefined, 64)
        }
    }
}