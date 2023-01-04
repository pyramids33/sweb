import { mergeHeaders } from "/deps/std/http/cookie_map.ts";
import tough from "npm:tough-cookie";
const { Cookie, CookieJar } = tough;

/**
 * wrap fetch with a cookieJar so cookies will be saved and sent with request
 * @param cookieJar an instance of cookieJar, defaults to new CookieJar()
 * @returns Response
 */
export function CookyFetch (cookieJar?:typeof CookieJar) {
    cookieJar = cookieJar || new CookieJar();
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
                const c = Cookie.parse(v);
                await cookieJar.setCookie(c, response.url);
            }
        }

        return response;
    }
}

