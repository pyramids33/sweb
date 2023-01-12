
import { assertEquals } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import { PaywallFile } from '/lib/paywallfile.ts';

const testName = path.basename(path.fromFileUrl(import.meta.url));

const pwf = new PaywallFile();
pwf.addPaywall('/test1/abc/x/', { outputs: [ { amount: 1 } ] });
pwf.addPaywall('/test1/*/x/', { outputs: [ { amount: 1 } ] });
pwf.addPaywall('/test1/*/x/fx', { outputs: [ { amount: 1 } ] });
pwf.addPaywall('/test1/*/x/special/', { outputs: [ { amount: 1 } ] });
pwf.addPaywall('/images', { outputs: [ { amount: 1 } ] });

{
    const expected = {
        "images": {
            "outputs": [{"amount": 1}],
        },
        "test1": {
            "/": {
                "abc": {
                    "/": {
                        "x": { outputs: [ { amount: 1 } ]}
                    }
                },
                "*": {
                    "/": {
                        "x": {
                            "/": {
                                "fx": { outputs: [ { amount: 1 } ]},
                                "special": { outputs: [ { amount: 1 } ]}
                            },
                            "outputs": [ { amount: 1 } ]
                        }
                    }
                }
            }
        }
    }
    assertEquals(pwf.paywalls, expected);
}
{
    const expected = {
        "/images": {"outputs": [{"amount": 1}]},
        "/test1/abc/x": {"outputs": [{"amount": 1}]},
        "/test1/*/x":  {"outputs": [{"amount": 1}]},
        "/test1/*/x/fx": {"outputs": [{"amount": 1}]},
        "/test1/*/x/special": {"outputs": [{"amount": 1}]}
    }
    assertEquals(pwf.toJSON(), expected)
}
{
    const result = pwf.matchUrl('/tset/abc/');
    assertEquals(result, undefined);
}
{
    // url matches specific pattern over wildcard
    const result = pwf.matchUrl('/test1/abc/x/');
    assertEquals(result, {
        match: "/test1/abc/x/",
        pattern: "/test1/abc/x",
        spec: { outputs: [ { amount: 1 } ] }
    });
}
{
    // url matches wilcard pattern
    const result = pwf.matchUrl('/test1/xyz/x/');
    assertEquals(result, {
        match: "/test1/xyz/x/",
        pattern: "/test1/*/x",
        spec: { outputs: [ { amount: 1 } ] }
    });
}
{
    // url matches pattern with most matching segments
    const result = pwf.matchUrl('/test1/xyz/x/fx');
    assertEquals(result, {
        match: "/test1/xyz/x/fx",
        pattern: "/test1/*/x/fx",
        spec: { outputs: [ { amount: 1 } ] }
    });
}
{
    // url matches prefix
    const result = pwf.matchUrl('/test1/xyz/x/fx2');
    assertEquals(result, {
        match: "/test1/xyz/x/",
        pattern: "/test1/*/x",
        spec: { outputs: [ { amount: 1 } ] }
    });
}
{

    const result1 = pwf.matchUrl('/images/');
    const result2 = pwf.matchUrl('/images/volcano.jpeg');
    assertEquals(result1, {
        match: "/images/",
        pattern: "/images",
        spec: { outputs: [ { amount: 1 } ] }
    });
    assertEquals(result2, {
        match: "/images/",
        pattern: "/images",
        spec: { outputs: [ { amount: 1 } ] }
    });
}
{
    // de/serialization
    const pwf2 = PaywallFile.fromJSON(JSON.stringify(pwf));
    assertEquals(JSON.stringify(pwf2), JSON.stringify(pwf));
}

console.log(testName, 'passed')