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

/**
 * Uses Deno.run to execute commands, saves the output to file, then returns the status. 
 * Each run will append an incrementing number to the file names.
 * 
 * @example
 * const cmd = new CommandRunner(testPath);
 * const result = await cmd.run('myTool', '--option', myOption);
 * assertEquals(result.status.success, true);
 * assertEquals(result.status.code, 0);
 * assertEquals(result.stdErrText, '');
 * assertStringIncludes(result.stdOutText, 'success');
 *
 */
export class CommandRunner {
    
    testPath:string
    counter:number

    /**
     * @param testPath path to save output files
     */
    constructor (testPath:string) {
        this.testPath = testPath
        this.counter = 0;
    }

    /**
     * @param args the arguments for Deno.run({ cmd: <args> })
     * @returns result of running the command, status, stdOut, stdErr (CommandRunnerResult)
     */
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
        this.counter++;
        return new CommandRunnerResult(status, stdOut, stdErr);
    }
}