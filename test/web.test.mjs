import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { detectDevice, isPrivateHubHost, validatePairingUrl } from "../web/pairing.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public web entry is deployable below /clipbridge without root-relative assets", async () => {
  const html = await read("web/index.html");
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/);
});

test("public web entry keeps pairing secrets out of storage and network requests", async () => {
  const app = await read("web/app.js");
  assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(app, /fetch\s*\(\s*result\.url/);
  assert.match(app, /window\.location\.assign\(result\.url\.href\)/);
});

test("pairing entry accepts private hubs and rejects public or malformed links", () => {
  assert.equal(validatePairingUrl("http://192.168.1.9:39393/ui?pair=123456").ok, true);
  assert.equal(validatePairingUrl("https://clipbridge.local/ui?pair=123456").ok, true);
  assert.equal(validatePairingUrl("https://example.com/ui?pair=123456").ok, false);
  assert.equal(validatePairingUrl("http://192.168.1.9:39393/ui?pair=123").ok, false);
  assert.equal(validatePairingUrl("javascript:alert(1)").ok, false);
  assert.equal(isPrivateHubHost("172.31.4.5"), true);
  assert.equal(isPrivateHubHost("172.32.4.5"), false);
});

test("public entry labels common device families", () => {
  assert.equal(detectDevice("Mozilla/5.0 (iPhone)").name, "这台 iPhone");
  assert.equal(detectDevice("Mozilla/5.0 (Linux; Android 15)").name, "这台 Android");
  assert.equal(detectDevice("Mozilla/5.0 (Windows NT 10.0)").name, "这台 Windows 电脑");
  assert.equal(detectDevice("Mozilla/5.0 (Macintosh)", 3).name, "这台 iPad");
});

test("mobile pairing input avoids Safari focus zoom", async () => {
  const styles = await read("web/styles.css");
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*input \{ font-size: 16px; \}/);
});

test("manifest and service worker stay scoped to the project page", async () => {
  const manifest = JSON.parse(await read("web/manifest.webmanifest"));
  const worker = await read("web/sw.js");
  const app = await read("web/app.js");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.match(worker, /requestUrl\.origin !== self\.location\.origin/);
  assert.doesNotMatch(worker, /\/api\//);
  assert.match(app, /!isLocalPreview/);
});

test("GitHub Pages workflow tests before deploying the static web directory", async () => {
  const workflow = await read(".github/workflows/pages.yml");
  assert.match(workflow, /needs: test/);
  assert.match(workflow, /path: \.\/web/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
