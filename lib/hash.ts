import { createHash } from "/deps/std/node/crypto.ts";
import { iterateReader } from "/deps/std/streams/iterate_reader.ts";
import type { Buffer } from "/deps/std/node/internal/buffer.d.ts"

type Encoding = "hex"|"binary"|"base64"|"base64url"|undefined
type StringOrBuffer<Encoding> = Encoding extends string ? string : Buffer;

export async function hashFile<T extends Encoding> (algorithm:string, filePath:string, encoding:T) : Promise<StringOrBuffer<T>> {
    const hash = createHash(algorithm);
    const file = await Deno.open(filePath);
    for await (const chunk of iterateReader(file)) {
        hash.update(chunk);
    }
    file.close();
    return hash.digest(encoding) as StringOrBuffer<T>;
}

export function hash<T extends Encoding> (algorithm:string, data:string|ArrayBuffer, encoding:T) : StringOrBuffer<T> {
    return createHash(algorithm).update(data).digest(encoding) as StringOrBuffer<T>;
}

export function sha256hex (data:string|ArrayBuffer) : string {
    return hash('sha256',data,'hex');
}

// import { bufferToHex, hexToBuffer } from "/deps/hextools/mod.ts";

// export async function getAuthKeyHash(authKey:string) {
//     return bufferToHex(await crypto.subtle.digest('SHA-256', hexToBuffer(authKey)));
// }