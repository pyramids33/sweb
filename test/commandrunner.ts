import * as path from '/deps/std/path/mod.ts';

export class CommandRunnerResult {

    status:Deno.ProcessStatus
    stdOut:Uint8Array
    stdErr:Uint8Array
    stdOutText:string
    stdErrText:string

    constructor (status:Deno.ProcessStatus, stdOut:Uint8Array, stdErr:Uint8Array) {
        this.status = status;
        this.stdOut = stdOut;
        this.stdErr = stdErr;
        this.stdOutText = new TextDecoder().decode(this.stdOut);
        this.stdErrText = new TextDecoder().decode(this.stdErr);
    }
}

export class CommandRunner {
    
    testPath:string
    counter:number

    constructor (testPath:string) {
        this.testPath = testPath
        this.counter = 0;
    }

    async run (...args:string[]) : Promise<CommandRunnerResult> {
        const outFilePath = path.join(this.testPath, `out${this.counter}.txt`);
        const errFilePath = path.join(this.testPath, `err${this.counter}.txt`);
        const process = Deno.run({ cmd: args, stdout: "piped", stderr: "piped" });

        const [ stdOut, stdErr, status ] = await Promise.all([ 
            process.output(), process.stderrOutput(), process.status() ]);
        
        await Promise.all([
            Deno.writeFile(outFilePath, stdOut),
            Deno.writeFile(errFilePath, stdErr)
        ]);

        process.close();

        return new CommandRunnerResult(status, stdOut, stdErr);
    }
}