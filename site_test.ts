import { assertEquals } from "/deps/std/testing/asserts.ts";
import { serveSite } from "/site_app.ts";
import { Config } from "/types.ts";

const testConfig:Config = {
    listenOptions: {
        port: 8098,
        hostname: '127.0.0.1'
    },
    cookieSecret: ['devsecret'],
    siteDir: './test',
    env: 'dev',
    staticPath: './static'
};

Deno.test("server", async function () {
    const abortController = new AbortController();
    const serverClosed = serveSite(testConfig, abortController.signal);

    {
        const res = await fetch('http://127.0.0.1:8098/.status');
        const body = await res.text();

        assertEquals(res.status, 200, '/.status returns 200');
        assertEquals(body, 'OK', '/.status returns OK');
    }

    {
        const res = await fetch('http://127.0.0.1:8098/.hascookie');
        const body = await res.text();
        
        assertEquals(res.status, 200, '/.hascookie status === 200');
        assertEquals(body, '0', '/.hascookie body === 0');
    }

    abortController.abort();
    await serverClosed;
});

