import { createHash } from "/deps/std/node/crypto.ts";
import { iterateReader } from "/deps/std/streams/iterate_reader.ts";
import { Buffer } from "/deps/std/node/buffer.ts"

type Encoding = "hex"|"binary"|"base64"|"base64url"|undefined
type StringOrBuffer<Encoding> = Encoding extends string ? string : Buffer;

export async function hashFile<T extends Encoding> (algorithm:string, filePath:string, encoding:T) : Promise<StringOrBuffer<T>> {
    const hash = createHash(algorithm);
    let file;
    try {
        file = await Deno.open(filePath);
        for await (const chunk of iterateReader(file)) {
            hash.update(chunk);
        }
    } finally {
        if (file) { 
            file.close(); 
        }
    }
    return hash.digest(encoding) as StringOrBuffer<T>;
}

export function hash<T extends Encoding> (algorithm:string, data:ArrayBuffer, encoding:T) : StringOrBuffer<T> {
    return createHash(algorithm).update(data).digest(encoding) as StringOrBuffer<T>;
}

export function sha256hex (data:ArrayBuffer) : string {
    return hash('sha256', data, 'hex');
}