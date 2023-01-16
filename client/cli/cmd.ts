import * as commander from "npm:commander";

import { activateAuthKeyCmd } from "/client/cli/cmd_activateauthkey.ts";
import { addPaywallCmd } from "/client/cli/cmd_addpaywall.ts";
import { downloadFileCmd } from "/client/cli/cmd_downloadfile.ts";
import { getApiStatusCmd } from "/client/cli/cmd_getapistatus.ts";
import { getFileInfoCmd } from "/client/cli/cmd_getfileinfo.ts";
import { getPaymentsCmd } from "/client/cli/cmd_getpayments.ts";
import { initCmd } from "/client/cli/cmd_init.ts";
import { processTxCmd } from "/client/cli/cmd_processtx.ts";
import { publishCmd } from "/client/cli/cmd_publish.ts";
import { redeemFundsCmd } from "/client/cli/cmd_redeemfunds.ts";
import { reindexFilesCmd } from "/client/cli/cmd_reindexfiles.ts";
import { removePaywallCmd } from "/client/cli/cmd_removepaywall.ts";
import { setConfigCmd } from "/client/cli/cmd_setconfig.ts";
import { setHdKeyCmd } from "/client/cli/cmd_sethdkey.ts";
import { showConfigCmd } from "/client/cli/cmd_showconfig.ts";
import { showDiffCmd } from "/client/cli/cmd_showdiff.ts";
import { showDnsCodeCmd } from "/client/cli/cmd_showdnscode.ts";
import { showFilesCmd } from "/client/cli/cmd_showfiles.ts";
import { showOutputsCmd } from "/client/cli/cmd_showoutputs.ts";
import { showPaymentsCmd } from "/client/cli/cmd_showpayments.ts";
import { showPaywallsCmd } from "/client/cli/cmd_showpaywalls.ts";
import { uploadFileCmd } from "/client/cli/cmd_uploadfile.ts";

/*

init

set-config --authKey --siteUrl
set-hdkey --xprv --xpub --random

add-paywall <pattern> <amount> [description] [address or paymail]
remove-paywall <pattern> <outputNum>

reindex-files
show-diff

activate-authkey
delete-url
download-file
get-api-status
get-payments
get-fileinfo
publish
rename-url
upload-file


process-tx
redeem-funds

show-balance
show-changes
show-config
show-dnscode
show-files --db --fs
show-outputs
show-payments
show-paywalls

*/

export const cmd = new commander.Command('sweb');
cmd.addCommand(initCmd);

cmd.addCommand(setConfigCmd);
cmd.addCommand(setHdKeyCmd);

cmd.addCommand(addPaywallCmd);
cmd.addCommand(removePaywallCmd);

cmd.addCommand(reindexFilesCmd);
cmd.addCommand(showDiffCmd);

cmd.addCommand(activateAuthKeyCmd);
cmd.addCommand(downloadFileCmd);
cmd.addCommand(getApiStatusCmd);
cmd.addCommand(getPaymentsCmd);
cmd.addCommand(getFileInfoCmd);
cmd.addCommand(publishCmd);
cmd.addCommand(uploadFileCmd);

cmd.addCommand(processTxCmd);
cmd.addCommand(redeemFundsCmd);

cmd.addCommand(showConfigCmd);
cmd.addCommand(showDnsCodeCmd);
cmd.addCommand(showFilesCmd);
cmd.addCommand(showOutputsCmd);
cmd.addCommand(showPaymentsCmd);
cmd.addCommand(showPaywallsCmd);



















