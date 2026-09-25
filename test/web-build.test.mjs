import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("the public PWA is subpath-safe and installable", async () => {
  const landing = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const html = await readFile(new URL("../web/transfer.html", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../web/manifest.webmanifest", import.meta.url), "utf8"));
  const app = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  const i18n = await readFile(new URL("../web/i18n.js", import.meta.url), "utf8");
  assert.match(landing, /href="\.\/manifest\.webmanifest"/);
  assert.match(landing, /href="\.\/transfer\.html"/);
  assert.match(landing, /property="og:image"/);
  assert.match(landing, /id="language-toggle"/);
  assert.match(landing, /id="faq"/);
  assert.match(landing, /id="demo"/);
  assert.match(landing, /media\/clipbridge-demo\.mp4/);
  assert.match(landing, /Agent Handoff 需要两台电脑都安装 ClipBridge/);
  assert.match(landing, /Start-ClipBridge-Mac\.command/);
  assert.match(landing, /Start-ClipBridge-Tray\.cmd/);
  assert.equal(manifest.start_url, "./transfer.html");
  assert.equal(manifest.scope, "./");
  assert.match(app, /RTCPeerConnection/);
  assert.match(app, /SHA-256/);
  assert.match(app, /48\*1024/);
  assert.match(app, /rooms\/\$\{code\}\/connect/);
  assert.match(html, /id="room-input"/);
  assert.match(html, /id="language-toggle"/);
  assert.match(html, /src="\.\/i18n\.js"/);
  assert.match(i18n, /clipbridge\.language\.v1/);
  assert.match(i18n, /Connect two devices directly/);
  assert.doesNotMatch(html, /offer-out|answer-in/);
});

test("the web build contains the offline shell, demo, and PWA icons", async () => {
  for (const path of ["index.html", "404.html", "landing.css", "landing.js", "transfer.html", "i18n.css", "i18n.js", "app.js", "sw.js", "vendor/qrcode.js", "manifest.webmanifest", "assets/icon-192.png", "assets/icon-512.png", "assets/social-card.png", "media/clipbridge-demo.mp4", "media/clipbridge-demo-poster.jpg"]) {
    assert.ok((await stat(new URL(`../dist/web/${path}`, import.meta.url))).size > 0, path);
  }
});
