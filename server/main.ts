
import { serveSite } from "/server/servesite.ts";
import { AppState } from "/server/appstate.ts";
import { Config } from "/server/types.ts";
import { WorkerCluster } from "/server/cluster.ts";

import mstime from "/lib/mstime.ts";
import { sha256hex } from "/lib/hash.ts";

if (import.meta.main) {

    if (Deno.args.length === 0 || Deno.args[0] === '--help') {
        console.error('Usage: swebsvr <config.json> ');
        Deno.exit();
    }

    const abortController = new AbortController();
    Deno.addSignalListener("SIGTERM", () => abortController.abort());
    Deno.addSignalListener("SIGINT", () => abortController.abort());
    Deno.addSignalListener("SIGHUP", () => abortController.abort());

    const configFilePath = Deno.args[0];
    const config:Config = JSON.parse(Deno.readTextFileSync(configFilePath));
    const appState = new AppState(config);

    if (config.ensureDirs) {
        await appState.sitePath.ensureDirs();
    }

    if (config.initAuthKey) {
        appState.openSiteDb().meta.setValue('$.config.authKeyHash', sha256hex(config.initAuthKey));
    }

    // only in main, not worker
    appState.runSessionDbCopier(abortController.signal, 60000).catch(console.error); 

    if (config.workers && config.workers.length > 0) {

        const workers = [ ...config.workers ];
        
        if (config.listenOptions.port) {
            workers.unshift({ port: config.listenOptions.port });
        }

        const cluster = new WorkerCluster();
        
        for (const [ workerId, { port } ] of workers.entries()) {
            cluster.startWorker(workerId, port, config);
        }

        Deno.addSignalListener("SIGTERM", () => cluster.close());
        Deno.addSignalListener("SIGINT", () => cluster.close());
        Deno.addSignalListener("SIGHUP", () => cluster.close());

    } else {
        appState.runSessionDbUncacher(abortController.signal, mstime.mins(10)).catch(console.error);
        appState.runPaywallFileReloader(mstime.secs(30));
        appState.runXPubReloader(mstime.secs(30));
        await serveSite(appState, {
            abortSignal: abortController.signal,
            onListen: () => {
                console.log(`listening ${config.listenOptions.hostname}:${config.listenOptions.port}`)
            }
        });
        appState.close();
        console.log('M/ server closed');
    }
}