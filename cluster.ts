import { Config } from "./types.ts";

interface WorkerInfo {
    workerId:number
    worker:Worker
    port:number
}

// worker.addEventListener("error", () => {
//     console.log("worker.onerror in main thread");
//      terminate, restart
// });

// window.addEventListener("unhandledrejection", () => {
//     console.log("window.onunhandledrejection in main thread");
// });


export class WorkerCluster {

    workers:Record<string,WorkerInfo> = {};
    closing = false;

    constructor () {}

    startWorker (workerId:number, port:number, config:Config) {
        const worker = new Worker(new URL("./worker.ts", import.meta.url).href, { type: "module" });
        
        // message from worker.ts
        worker.addEventListener('message', (event:MessageEvent) => {
            if (event.data.message === 'ready') {
                config.listenOptions.port = port;
                config.workerId = workerId;
                worker.postMessage({ message: 'init', config, workerId });
            }
            if (event.data.message === 'payment') {
                this.broadcast(event.data);
            }
            if (event.data.message === 'closing') {
                Deno.unrefTimer(setTimeout(() => this.closeWorker(workerId), 2000));
            }
            if (event.data.message === 'closed') {
                this.closeWorker(workerId);
            }
        });

        worker.addEventListener("error", () => {
            console.log("worker.onerror in main thread");
            this.closeWorker(workerId);
            this.startWorker(workerId, port, config);
        });

        this.workers[workerId.toString()] = { worker, workerId, port };
    }

    broadcast (message:unknown) {
        for (const info of Object.values(this.workers)) {
            info.worker.postMessage(message);
        }
    }

    close () {
        if (!this.closing) {
            this.closing = true;
            for (const [_,winfo] of Object.entries(this.workers)) {
                // message to worker.ts
                winfo.worker.postMessage({ message: 'close' });
            }
        }
    }

    closeWorker (workerId:number) {
        const info = this.workers[workerId.toString()];
        if (info) {
            info.worker.terminate();
            delete this.workers[workerId.toString()];
        }
    }
}