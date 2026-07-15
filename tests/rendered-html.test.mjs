import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function builtMarketplaceBundle(directory) {
  const files = await readdir(new URL(directory, import.meta.url));
  const bundle = files.find((file) => /^okok-app-.*\.js$/.test(file));
  assert.ok(bundle, `missing compiled OK-OK bundle in ${directory}`);
  return readFile(new URL(directory + bundle, import.meta.url), "utf8");
}

test("production build contains the OK-OK marketplace shell", async () => {
  const [client, server] = await Promise.all([
    builtMarketplaceBundle("../dist/client/assets/"),
    builtMarketplaceBundle("../dist/server/ssr/assets/"),
  ]);
  for (const output of [client, server]) {
    assert.match(output, /OK-OK/);
    assert.match(output, /The thrill of the rack, online/);
    assert.match(output, /Shop the latest drop/);
    assert.match(output, /Mine/);
    assert.match(output, /Steal/);
    assert.match(output, /Grab/);
    assert.doesNotMatch(output, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  }
});

test("keeps the requested routes, commerce rules, and metadata in source", async () => {
  const [app, layout, schema, server, hosting, packageJson] = await Promise.all([
    readFile(new URL("../app/okok-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server-market.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  for (const route of [
    "/login",
    "/signup",
    "/items",
    "/cart",
    "/messages",
    "/profile",
    "/profile/settings",
    "/sell/new",
  ]) {
    assert.ok(app.includes(route), "missing route " + route);
  }

  assert.match(server, /24 \* 60 \* 60 \* 1000/);
  assert.match(server, /10 \* 60 \* 1000/);
  assert.match(server, /This listing changed while you were viewing it/);
  assert.match(schema, /itemStateEvents/);
  assert.match(schema, /cartEntries/);
  assert.match(schema, /transactions/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(app, /_sites-preview|codex-preview/);
});

test("deep links and cloud bindings are present in the production artifact", async () => {
  const [catchAll, wrangler, worker] = await Promise.all([
    readFile(new URL("../app/[...slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
  ]);
  assert.match(catchAll, /OKOKApp/);
  assert.match(wrangler, /"binding":"DB"/);
  assert.match(wrangler, /"binding":"BUCKET"/);
  assert.match(worker, /cloudflare:workers/);
});
