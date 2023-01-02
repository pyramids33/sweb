import { emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals, assertStringIncludes } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';
import { Database } from "/deps/sqlite3/mod.ts";

import MetaDbModule from "/lib/database/metadb.ts";
import type { MetaDbApi } from "/lib/database/metadb.ts";

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const dbPath = path.join(testPath, 'sweb.db');
const db = new Database(dbPath, { int64: true });
db.exec('pragma journal_mode = WAL');
MetaDbModule.initSchema(db);
//const metaDb = MetaDbModule.getApi(db);

const q1 = db.prepare(`
    select json_extract(jsondata,:q) as jsondata, 
        json_type(jsondata,:q) as type 
    from __meta where rowid = 1
`);

const q2 = db.prepare(`update __meta set jsondata = json_set(jsondata, ?, ?) where rowid = 1`);
const q3 = db.prepare(`update __meta set jsondata = json_patch(jsondata, ?) where rowid = 1`);

q2.run('$.config.boop1', 'boopboop');
q2.run('$.config.boop2', JSON.stringify('boopboop'));
q2.run('$.config.boop3', JSON.stringify({x:7}));
q2.run('$.config.boop4', 7);

q3.run(JSON.stringify({ 'config': {'boop5': { 'x': 7 }}}));

console.log(q1.all({ q: '$.config.boop1' }));
console.log(q1.all({ q: '$.config.boop2'}));
console.log(q1.all({ q: '$.config.boop3'}));
console.log(q1.all({ q: '$.config.boop4'}));
console.log(q1.all({ q: '$.config' }));

console.log(testName, 'passed');