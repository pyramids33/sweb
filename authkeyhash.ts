import { bufferToHex, hexToBuffer } from "/deps/hextools/mod.ts";

export async function getAuthKeyHash(authKey:string) {
    return bufferToHex(await crypto.subtle.digest('SHA-256', hexToBuffer(authKey)));
}