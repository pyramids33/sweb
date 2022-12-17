import { trimstr } from '/trimstring.ts';
import { Context, Parser, ParseError, Action } from './context.ts'

type MenuItem = [ Parser, ...Parser[] ];

/*
items is an array of item array: [[item, ...items]]
if the first item parses, the rest of the items are pushed to the stack
*/
export function Menu (...menuItems:MenuItem[]) : Parser {
    return {
        type: 'menu',
        help () {
            return menuItems.flatMap(item => item[0].help());
        },
        completion () {
            return menuItems.flatMap(item => item[0].completion()).filter(x => x !== undefined);
        },
        parse (ctx:Context) {
            for (const menuItem of menuItems) {
                try {
                    menuItem[0].parse(ctx);
                    ctx.addParsers(...menuItem.slice(1));
                    return;
                } catch (error) {
                    if (error instanceof ParseError) {
                        continue;
                    }
                    throw error;
                }
            }

            throw new ParseError(`unrecognized input: '${ctx.input.slice(0,20)}' `);
        }
    }
}

export function MenuItem (parser:Parser, ...parsers:Parser[]) : MenuItem { 
    return [ parser,...parsers ] 
}

export function Option (item:Parser, ...items:Parser[]) : Parser {
    return {
        type: 'option',
        help () {
            return item.help();
        },
        completion () {
            return item.completion();
        },
        parse (ctx:Context) {
            try {
                item.parse(ctx);
            } catch (error) {
                if (error instanceof ParseError) {
                    error.fatal = false;
                }
                throw error;
            }
            ctx.addParsers(...items);
        }
    }
}

interface KeywordParser extends Parser {
    keyword:string
    description:string
}

export function Keyword (theKeyword:string, description:string, ...items:Parser[]) : KeywordParser {
    return {
        type: 'keyword',
        keyword: theKeyword,
        description,
        valueName: theKeyword,
        help () {
            return [[ theKeyword, description ]];
        },
        completion () {
            return [ theKeyword ];
        },
        parse (ctx:Context) {
            const value = ctx.consumeWord(theKeyword);
            ctx.addResult({ parser:this, value });
            ctx.addParsers(...items);
        }
    }
}

export function Value (name:string, description:string, ...items:Parser[]) : Parser {
    return {
        type: 'value',
        valueName: name,
        description,
        help () {
            return [['<value>', description]];
        },
        completion () {
            return [];
        },
        parse (ctx:Context) {
            const value = trimstr(ctx.consumeArg().trim(), { both: '"' });
            ctx.addResult({ parser:this, value });
            ctx.addParsers(...items);
        }
    }
}

interface EOLParser extends Parser {
    action:Action
}

export function EOL (action:Action) : EOLParser {
    return {
        type: 'eol',
        action,
        completion () {
            return [];
        },
        help () {
            return [['eol', 'end of line']];
        },
        parse (ctx:Context) {
            if (ctx.input === '' || ctx.input === '\n') {
                ctx.addResult({ parser: this });
                ctx.addAction(action)
                ctx.completed = true;
            } else {
                throw new ParseError('eol expected');
            }
        }
    }
}
