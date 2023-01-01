

export async function tryStat (filePath:string) {
    try {
        return await Deno.stat(filePath);
    } catch(error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }
}

export function tryStatSync (filePath:string) {
    try {
        return Deno.statSync(filePath);
    } catch(error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }
}
