

export type Action = (ctx:Context) => void|Promise<void>

// Represent the app as a tree of parsers which update the Context
export interface Parser {
    type:string    
    valueName?:string
    description?:string
    help():[string,string][]
    completion():string[]
    parse(ctx:Context):void
}

export class ParseError extends Error {
    fatal:boolean
    constructor (message:string, fatal=true) {
        super(message);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ParseError);
        }
        this.name = 'ParseError';
        this.fatal = fatal;
    }
}

export function parseWord (word:string, input:string):number {
    if (input.startsWith(word + ' ') || input === word) {
        return word.length;
    }
    throw new ParseError('expected keyword: ' + word);
}

export function parseArg (input:string) {

    if (input.startsWith('"')) {
        let escapeMode = false;
        for (let i = 1; i < input.length; i++) {
            if (!escapeMode) {
                if (input[i] === '\\') {
                    escapeMode = true;
                    continue;
                } else if (input[i] === '"') {
                    return i+1;
                }
            } else {
                escapeMode = false;
            }
        }
        throw new ParseError('unclosed quote');
    } else {
        const i = (input+' ').indexOf(' ');
        if (i < 1) {
            throw new ParseError('no argument');
        }
        return i;
    }
}

interface ParseResult {
    parser: Parser
    error?:Error
    value?:string
}

export class Context {

    consumed:string[]
    input:string
    stack:Parser[]

    results:ParseResult[]
    action:Action = () => {}
    failed:boolean
    completed:boolean
    next?:Parser

    constructor (input = '', parser?:Parser) {
        this.consumed = [];
        this.input = input;
        this.stack = [];
        this.results = [];
        
        if (parser) {
            this.stack.push(parser);
        }

        this.failed = false;
        this.completed = false;
        this.next = undefined;
    }

    addParsers (...items:Parser[]) {
        if (items.length > 0) {
            this.stack = this.stack.concat(...items.slice().reverse());
        }
    }

    addResult (result:ParseResult) {
        this.results.push(result);
        if (result.error && !(result.error instanceof ParseError && result.error.fatal === false)){
            this.failed = true;
        }
    }

    addAction (action:Action) {
        const prevAction = this.action;
        this.action = async function (ctx:Context) {
            await prevAction(ctx);
            await action(ctx);
        }
    }

    consumeInput (len:number) {
        const value = this.input.slice(0, len);
        this.consumed.push(value); 
        this.input = this.input.slice(len);
        return value;
    }

    consumeWord (theWord:string) {
        const len = parseWord(theWord, this.input);
        return this.consumeInput(len);
    }

    consumeArg () {
        const len = parseArg(this.input);
        return this.consumeInput(len);
    }

    consumeSpaces () {
        let i = 0;

        while (i < this.input.length && this.input[i] === ' ') {
            i++;
        }

        if (i > 0) {
            this.consumeInput(i);
        }
    }

    getValues () {
        const obj: Record<string, string> = {};

        for (const [index,result] of this.results.entries()) {
            const key = result.parser.valueName || result.parser.type + index.toString();
            const value = result.value;
            if (value) {
                obj[key] = value;
            }
        }

        return obj;
    }

    getError () {
        return this.results.findLast(x => x.error && !(x.error instanceof ParseError && !x.error.fatal));
    }

    getCompletion () {
        return this.results.filter(x => x.error).flatMap(x => x.parser.completion())
    }

    getHelp () {
        return this.results.filter(x => x.error).flatMap(x => x.parser.help())
    }

    async exec () {
        return await this.action(this);
    }

    parse () {
        while (true) {
            this.consumeSpaces();
            this.next = this.stack.pop();

            if (this.next === undefined) {
                return;
            }

            try {
                this.next.parse(this);
            } catch (error) {
                this.addResult({ parser: this.next, error });
                return;
            }
        }
    }
}

export function parse (input:string, parser:Parser) {
    const ctx = new Context(input, parser);
    ctx.parse();
    return ctx;
}

function printHelp (ctx:Context, addHelpHelp=false) {
    const help = ctx.getHelp();

    if (addHelpHelp) {
        help.push(['?','place ? at the end of any command to show help']);
    }

    const columnWidth = help.reduce((p,c) => Math.max(p, c[0].length), 0) + 6;
    const helpLines = help.map(y => `  ${y[0]}                              `.slice(0, columnWidth) + y[1]);
    
    console.log('help: \n' + helpLines.join('\n') + '\n');
}

export async function exec (input:string, parser:Parser) {

    if (input.endsWith(' =') || input === '=') {
        try {
            input = input.slice(0, -1);
            const ctx = new Context(input, parser);
            ctx.parse();
            const matches = ctx.getCompletion().filter(x => x.startsWith(input.trim()));
            console.log(matches.join('\n'))
        } catch { /** */ }
        return;
    }

    const helpSeq = ['?','--help','-h','/?'].find(x => x == input || input.endsWith(' '+x));

    if (helpSeq) {
        try { 
            input = input.slice(0, -helpSeq.length);
            const ctx = new Context(input, parser);
            ctx.parse();
            printHelp(ctx, input === '');
        } catch (error) { 
            console.error('error: ' + error.message);
        }
        return;
    }
    try {
        const ctx = new Context(input, parser);
        ctx.parse();

        if (ctx.completed) {
            await ctx.exec()
        } else {
            if (ctx.failed) {
                const errorResult = ctx.getError();
    
                if (errorResult && errorResult.error) {
                    console.log('error: ' + errorResult.error.message);
                }
            }

            printHelp(ctx, input === '');
        }

        return ctx;
    } catch (error) { 
        console.error('error: ' + error.message);
    }
}
