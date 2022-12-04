
// int, bigint, or string containing bigint
export function bigInt (value:unknown, def?:bigint) : bigint|undefined {
    try {
        if (typeof(value) === 'string') {
            return BigInt(value);
        }
    } catch {
        /* ignore */
    }
    return def;
}

// safe int, or string containing safe int
export function safeInt (value:unknown, def?:number, base?:number) : number|undefined {
    if (typeof(value) === 'number' && Number.isSafeInteger(value)) {
        return value;
    }
    if (typeof(value) === 'string') {
        return safeInt(parseInt(value.trim(), base), def, base);
    }
    return def;
}

export function number (value:unknown, def?:number, base?:number) : number|undefined {
    if (typeof(value) === 'number' && !isNaN(value)) {
        return value;
    }
    if (typeof(value) === 'string') {
        return number(parseFloat(value.trim()), def, base);
    }
    return def;
}

// a string
export function string (value:unknown, def?:string) : string|undefined {
    if (typeof(value) === 'string') {
        return value;
    }
    return def;
}

export function trimmedString (value:unknown, def?:string) : string|undefined {
    if (typeof(value) === 'string') {
        return value.trim();
    }
    return def;
}

const hashRegex = /^[a-f0-9]{64}$/;

export function sha256HashHexString (value:unknown, def?:string) : string|undefined {
    if (typeof(value) !== 'string') {
        return def;
    }
    if (hashRegex.test(value)) {
        return value;
    }
    return def;
}