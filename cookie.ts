import { default as id128 } from "npm:id128";
import { Context } from "/deps/oak/mod.ts";

import mstime from "/mstime.ts";
import { AppState } from "/types.ts";

type Next = () => Promise<unknown> | unknown;

async function readWriteCookie (ctx:Context<AppState>, next:Next) {
    ctx.state.session = JSON.parse((await ctx.cookies.get("session")) || '{}');
    await next();
    await ctx.cookies.set("session", JSON.stringify(ctx.state.session), {
        maxAge: mstime.hours(7),
        sameSite: 'lax',
        httpOnly: true
    });
}

function hasCookie (ctx:Context<AppState>) {
    // Users with no cookie should be given a cookie and shown nocookie.html, which calls this route
    // to check the users cookie.
    // The user should have a cookie on that page. If not they might have disabled cookies.
    ctx.response.status = 200;

    if (!ctx.state.session.token) {
        ctx.response.body = '0';
    } else {
        ctx.response.body = '1';
    }
}

async function checkCookie (ctx:Context<AppState>, next:Next) {
    const { config, session } = ctx.state;

    if (!session.token) {
        session.token = id128.Ulid.generate().toCanonical();
        ctx.response.status = 200;
        await ctx.send({ root: config.staticPath, path: 'nocookie.html' });
        return;
    } else {
        if (!session.tokenTime) {
            session.tokenTime = Date.now();
            session.visitTime = Date.now();

            //req.tokenDb = dbCache.getTokenDb(req.siteId, req.session.token);
            //req.tokenDb.setCheckIn(Date.now());
        } else {
            // reset tokenping every hour
            // the token db can be removed if not updated for 8 hours
            if (session.visitTime === undefined || session.visitTime < mstime.hoursAgo(1)) {
                //req.tokenDb = dbCache.getTokenDb(req.siteId, req.session.token, { fileMustExist: true });
                //req.tokenDb.setCheckIn(Date.now());
            }

            // modifying cookie extends cookie expiry
            session.visitTime = Date.now();
        }
    }

    await next();
}

export {
    readWriteCookie,
    hasCookie,
    checkCookie
}