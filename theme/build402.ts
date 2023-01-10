import nunjucks from "npm:nunjucks";
import * as path from "/deps/std/path/mod.ts";
import { Buffer } from "/deps/std/node/buffer.ts";
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

interface PageVars {
    title: string
    styles: Record<string,string>
    scripts: Record<string,string>
}

const vars:PageVars = {
    title:'402 Payment Required',
    styles:{},
    scripts:{}
};

vars.styles = {};
vars.styles.bootstrap_reboot = Deno.readTextFileSync(path.join(__dirname, 'static', 'bootstrap-reboot.min.css'));
vars.styles.base = Deno.readTextFileSync(path.join(__dirname, 'static', 'base.css'));

vars.scripts = {};
vars.scripts.qrcodejs = Deno.readTextFileSync(path.join(__dirname, 'qrcode.min.js'));
vars.scripts._402js = Deno.readTextFileSync(path.join(__dirname, '402.js'));

vars.styles.iconsCss = [
    ['payment-required', 'static/paymentrequired.png'],
    ['simplycash', 'static/simplycash.png']
].map(function ([name,filename]) {
    const buf = Deno.readFileSync(path.join(__dirname, filename));
    const b64 = Buffer.from(buf).toString('base64');
    return `.icon-${name} { background-image: url("data:image/png;base64,${b64}"); }`;
}).join('\n');

const nj = nunjucks.configure([__dirname], { autoescape: true });
const html = nj.render('templates/402.njk', vars);

Deno.writeFileSync(Deno.args[0], html);
