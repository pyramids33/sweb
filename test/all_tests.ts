// got a seg fault, something to do with sqlite3 ffi
//await import("./tests/getpayments_test.ts")
await import("./tests/cli_init_test.ts")
await import("./tests/cli_sitemap_test.ts")
await import("./tests/cli_reindex_test.ts")
//await import("./tests/cli_publish_test.ts")
await import("./tests/cli_paywalls_test.ts")
await import("./tests/cli_redeem_test.ts")
//await import("./tests/server_createsite_test.ts")
await import("./tests/server_emptysite_test.ts")
await import("./tests/server_paywall_test.ts")
await import("./tests/paywall_test.ts")
await import("./tests/metadb_test.ts")
await import("./tests/pathmap_test.ts")