import { emptyDirSync } from '/deps/std/fs/mod.ts';
import { assertEquals } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';

import MetaDbModule from '/lib/database/metadb.ts';
import { openDb } from '/lib/database/mod.ts';

// create a empty directory for test data
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const testName = path.basename(path.fromFileUrl(import.meta.url));
const testPath = path.join(__dirname, '..', 'temp', testName);
emptyDirSync(testPath);

const dbPath = path.join(testPath, 'sweb.db');
const metaDb = openDb(MetaDbModule, dbPath);

metaDb.setValue('$.config.v1', 'boop');
metaDb.setValue('$.config.v2', 7);
metaDb.setValue('$.config.v3', JSON.stringify('boop'));
metaDb.setValue('$.config.v4', JSON.stringify({ v: 4}));
metaDb.setValue('$.config.v5', { v: 5 });

const v1 = metaDb.getValue('$.config.v1') as string;
assertEquals(v1, 'boop');

const v2 = metaDb.getValue('$.config.v2') as number;
assertEquals(v2, 7);

const v3 = metaDb.getValue('$.config.v3') as string;
assertEquals(v3, '"boop"');

const v4 = metaDb.getValue('$.config.v4') as string;
assertEquals(v4, '{"v":4}');

const v5 = metaDb.getValue('$.config.v5') as Record<string,unknown>;
assertEquals(v5, { "v":5 });

const cfg = metaDb.getValue('$.config') as Record<string,unknown>;

assertEquals(cfg, { 
    v1: "boop", 
    v2: 7, 
    v3: '"boop"', 
    v4: '{"v":4}', 
    v5: { v: 5 } 
});

metaDb.db.close();

console.log(testName, 'passed');