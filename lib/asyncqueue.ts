type Fn = (...args: unknown[]) => unknown;


export class AsyncQueue<T=void> {

    promises:Promise<T>[]
    concurrency:number

    constructor (concurrency=5) {
        this.promises = [];
        this.concurrency = concurrency;
    }

    async queue (value: T|Promise<T>) {
        const promise = Promise.resolve(value).finally(() => this.promises = this.promises.filter(p => p !== promise))

        this.promises.push(promise);

        if (this.promises.length >= this.concurrency) {
            await Promise.race(this.promises);
        }
    }

    async queueFn (arg:(() => T|Promise<T>)) {
        return await this.queue(arg());
    }

    async done () {
        await Promise.all(this.promises);
    }
}
