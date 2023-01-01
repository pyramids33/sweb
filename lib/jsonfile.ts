

export async function read (filePath:string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}

export async function tryRead<T>(filePath:string, failVal?:T) : Promise<T|undefined> {
    try {
        return await read(filePath);
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
        return failVal;
    }
}

// export function readSync (filepath) {
//     return JSON.parse(fs.readFileSync(filepath).toString());
// }

// export async function write (filepath, object, overwrite, space) {
//     await fsWriteFile(filepath, Buffer.from(JSON.stringify(object,null,space)), { flag: (overwrite ? 'w' : 'wx') });
// }

// export async function overwrite (filepath, object, space) {
//     await write(filepath, object, true, space);
// }

// export function writeSync (filepath, object, overwrite, space) {
//     fs.writeFileSync(filepath, Buffer.from(JSON.stringify(object,null,space)), { flag: (overwrite ? 'w' : 'wx') });
// }
// export async function overwriteSync (filepath, object, space ) {
//     writeSync(filepath, object, true, space);
// }
