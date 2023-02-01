
import { assertEquals } from '/deps/std/testing/asserts.ts';
import * as path from '/deps/std/path/mod.ts';
import { PathMapper } from "/server/pathmapper.ts";

const testName = path.basename(path.fromFileUrl(import.meta.url));

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const examplePath = path.join(__dirname, '../data/example')

{
    const pathMapper = new PathMapper([{ urlPrefix: '/test/mypath', pathPrefix: examplePath }]);
    const fileRow = await pathMapper.mapPath('/test/mypath2/docs/index.html');
    assertEquals(fileRow, undefined);
}
{
    const pathMapper = new PathMapper([{ urlPrefix: '/test/mypath2/', pathPrefix: examplePath }]);
    const fileRow = await pathMapper.mapPath('/test/mypath2/docs/index.html');
    assertEquals(fileRow?.storagePath, path.join(examplePath, '/docs/index.html'));
}
{
    const pathMapper = new PathMapper([{ urlPrefix: '/test/mypath2', pathPrefix: examplePath }]);
    const fileRow1 = await pathMapper.mapPath('/test/mypath2/docs/index.html');
    assertEquals(fileRow1?.storagePath, path.join(examplePath, '/docs/index.html'));

    const fileRow2 = await pathMapper.mapPath('/test/mypath2/docs2/');
    assertEquals(fileRow2?.storagePath, path.join(examplePath, '/docs2/default.html'));

    const fileRow3 = await pathMapper.mapPath('/test/mypath2/docs2');
    assertEquals(fileRow3, undefined);
}

console.log(testName, 'passed')