export type TrimStringOptions = {
    prefix?:string
    suffix?:string
    both?:string
}

export function trims (theString:string, { prefix, suffix, both }:TrimStringOptions) {
    if (both) {
        prefix = suffix = both;
    }

    let startPos = 0;
    let endPos = theString.length;

    if (prefix) {
        while (theString.startsWith(prefix, startPos)) { startPos++; }
    }

    if (suffix) {
        while (theString.endsWith(suffix, endPos)) { endPos--; }
    }

    return theString.slice(startPos, endPos);
}