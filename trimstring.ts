type TrimStringOptions = {
    prefix?:string
    suffix?:string
    both?:string
}

export function trimstr (theString:string, { prefix, suffix, both }:TrimStringOptions) {
    if (both) {
        prefix = suffix = both;
    }

    let s = 0;
    let e = theString.length;

    if (prefix) {
        while (theString.startsWith(prefix, s)) { s++; }
    }

    if (suffix) {
        while (theString.endsWith(suffix, e)) { e--; }
    }

    return theString.slice(s, e);
}