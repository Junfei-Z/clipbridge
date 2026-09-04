import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("the public PWA is subpath-safe and installable", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../web/manifest.webmanifest", import.meta.url), "utf8"));
  const app = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.match(app, /RTCPeerConnection/);
  assert.match(app, /SHA-256/);
  assert.match(app, /48\*1024/);
});

test("the web build contains the offline shell and PWA icons", async () => {
  for (const path of ["index.html", "404.html", "app.js", "sw.js", "manifest.webmanifest", "assets/icon-192.png", "assets/icon-512.png"]) {
    assert.ok((await stat(new URL(`../dist/web/${path}`, import.meta.url))).size > 0, path);
  }
});
