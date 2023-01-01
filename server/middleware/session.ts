import { default as id128 } from "npm:id128";
import { Context } from "/deps/oak/mod.ts";

import mstime from "/lib/mstime.ts";
import { AppState } from "/server/appstate.ts";
import { Next } from "/server/types.ts";

export interface Session {
    sessionId?: string,
    createTime?: number
    visitTime?: number
}

async function readWriteSessionHeaders (ctx:Context<AppState>, next:Next) {
    const jsonString = await ctx.cookies.get("session");
    if (jsonString) {
        ctx.state.session = JSON.parse(jsonString);
    }
    await next();
    await ctx.cookies.set("session", JSON.stringify(ctx.state.session), {
        maxAge: mstime.hours(7)/1000, // actually seconds, not ms
        sameSite: 'lax',
        httpOnly: true
    });
}

function hasSession (ctx:Context<AppState>) {
    // Users with no cookie should be given a cookie and shown nocookie.html, which calls this route
    // to check the users cookie.
    // The user should have a cookie on that page. If not they might have disabled cookies.
    ctx.response.status = 200;

    if (!ctx.state.session.sessionId) {
        ctx.response.body = '0';
    } else {
        ctx.response.body = '1';
    }
}

async function checkSession (ctx:Context<AppState>, next:Next) {
    const { config, session } = ctx.state;

    if (!session.sessionId) {
        session.sessionId = id128.Ulid.generate().toCanonical();
        ctx.response.status = 200;
        await ctx.send({ root: config.staticPath, path: 'nocookie.html' });
        return;
    } else {
        if (!session.createTime) {
            session.createTime = Date.now();
            session.visitTime = Date.now();

            const sessionDb = ctx.state.openSessionDb(session.sessionId);
            sessionDb.setCheckIn(Date.now());
        } else {
            if (session.visitTime === undefined || session.visitTime < mstime.hoursAgo(1)) {
                const sessionDb = ctx.state.openSessionDb(session.sessionId);
                sessionDb.setCheckIn(Date.now());
            }
            session.visitTime = Date.now();
        }
    }

    await next();
}

export {
    readWriteSessionHeaders,
    hasSession,
    checkSession
}