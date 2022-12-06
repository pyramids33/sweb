
import { serveSite } from "/servesite.ts";
import { AppState } from "/appstate.ts";
import { SitePath } from "/sitepath.ts";
import { Config } from "/types.ts";
import { getAuthKeyHash } from "/authkeyhash.ts";

if (Deno.args.length === 0) {
    console.error('provide path to config file');
    Deno.exit();
}

const configFilePath = Deno.args[0];
const config:Config = JSON.parse(Deno.readTextFileSync(configFilePath));

if (config.ensureDirs) {
    const sitePath = new SitePath(config.sitePath);
    await sitePath.ensureDirs();
}

const abortController = new AbortController();
Deno.addSignalListener("SIGTERM", () => abortController.abort());
Deno.addSignalListener("SIGINT", () => abortController.abort());
Deno.addSignalListener("SIGHUP", () => abortController.abort());

const appState = new AppState(config);

if (config.initAuthKey) {
    const authKeyHash = await getAuthKeyHash(config.initAuthKey);
    appState.openSiteDb().config.set({ authKeyHash });
}

await serveSite(appState, config, abortController.signal);
appState.close();
console.log('server closed.');