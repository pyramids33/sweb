import { serveSite } from "/servesite.ts";
import { AppState, Config } from "/appstate.ts";

if (Deno.args.length === 0) {
    console.error('provide path to config file');
    Deno.exit();
}

const config:Config = JSON.parse(Deno.readTextFileSync(Deno.args[0]));

const abortController = new AbortController();
Deno.addSignalListener("SIGTERM", () => abortController.abort());
Deno.addSignalListener("SIGINT", () => abortController.abort());
Deno.addSignalListener("SIGHUP", () => abortController.abort());

const appState = new AppState(config);
await serveSite(appState, config, abortController.signal);
appState.close();
console.log('server closed.');