
import { serveSite } from "/servesite.ts";
import { AppState } from "/appstate.ts";
import { Config } from "/types.ts";
import { getAuthKeyHash } from "/authkeyhash.ts";
import { WorkerCluster } from "./cluster.ts";

if (Deno.args.length === 0) {
    console.error('provide path to config file');
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
    const authKeyHash = await getAuthKeyHash(config.initAuthKey);
    appState.openSiteDb().config.set({ authKeyHash });
}

appState.runSessionDbCopier(abortController.signal, 60000).catch(console.error);

if (config.workers && config.workers.length > 0) {

    const workers = [{ workerId: config.workerId,  port: config.listenOptions.port||8080 }, ...config.workers ];

    const cluster = new WorkerCluster();
    
    for (const { workerId, port } of workers) {
        cluster.startWorker(workerId, port, config);
    }

    Deno.addSignalListener("SIGTERM", () => cluster.close());
    Deno.addSignalListener("SIGINT", () => cluster.close());
    Deno.addSignalListener("SIGHUP", () => cluster.close());

} else {
    await serveSite(appState, abortController.signal);
    appState.close();
    console.log('M/ server closed');
}
