import { Context } from "/cliparser/context.ts";
import { EOL, Keyword, Menu, MenuItem, Value } from "/cliparser/parsers.ts";

function initSite (ctx:Context) {
    const values = ctx.getValues();
    const pathToSite = values.path;
    console.log(values);
}

export const parser = Menu(
    MenuItem(
        Keyword('init', 'create a new site directory'),
        Value('path', 'path to new directory'),
        EOL(initSite)
    ),
    MenuItem(
        Keyword('publish', 'publish site directory'),
        Value('path', 'path to site directory'),
        EOL(initSite)
    )
)
