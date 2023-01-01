import { mergeHeaders } from "/deps/std/http/cookie_map.ts";
import tough from "npm:tough-cookie";
const { Cookie, CookieJar } = tough;

export function CookyFetch (cookieJar = new CookieJar()) {
    return async function (input:string|URL|Request, init:RequestInit|undefined) : Promise<Response> {

        const cookieString = await cookieJar.getCookieString(input instanceof Request ? input.url : input.toString());

        if (init === undefined) {
            init = { headers: { "Cookie": cookieString }};
        } else {
            init.headers = mergeHeaders(init.headers||{}, { "Cookie": cookieString });
        }
        
        const response = await fetch(input, init);
        
        for (const [k,v] of response.headers.entries()) {
            if (k.toLowerCase() === 'set-cookie') {
                await cookieJar.setCookie(Cookie.parse(v), response.url);
            }
        }

        return response;
    }
}

