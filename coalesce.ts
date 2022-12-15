
// int, bigint, or string containing bigint
export function bigInt<T> (value:unknown, def:T) : bigint|T {
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
export function safeInt<T> (value:unknown, def:T, base?:number) : number|T {
    if (typeof(value) === 'number' && Number.isSafeInteger(value)) {
        return value;
    }
    if (typeof(value) === 'string') {
        return safeInt(parseInt(value.trim(), base), def, base);
    }
    return def;
}

export function number<T> (value:unknown, def:T, base?:number) : number|T {
    if (typeof(value) === 'number' && !isNaN(value)) {
        return value;
    }
    if (typeof(value) === 'string') {
        return number(parseFloat(value.trim()), def, base);
    }
    return def;
}

// a string
export function string<T> (value:unknown, def:T, maxlength?:number) : string|T {
    if (typeof(value) === 'string') {
        if (maxlength) {
            return value.slice(0,maxlength);
        }
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