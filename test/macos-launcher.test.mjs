import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Mac launcher reads a quarantined child script through the system shell", async () => {
  const launcher = await readFile(new URL("../Start-ClipBridge-Mac.command", import.meta.url), "utf8");
  const builder = await readFile(new URL("../macos/build-app.sh", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../macos/ClipBridgeMenuBar.m", import.meta.url), "utf8");

  assert.match(launcher, /APP_PATH="\$\(\/bin\/bash "\$BUILD_SCRIPT"\)"/);
  assert.doesNotMatch(launcher, /APP_PATH="\$\("\$PROJECT_ROOT\/macos\/build-app\.sh"\)"/);
  assert.match(builder, /xcrun clang -fobjc-arc/);
  assert.match(builder, /ClipBridgeMenuBar\.m/);
  assert.doesNotMatch(builder, /^swiftc /m);
  assert.match(builder, /xattr -dr com\.apple\.quarantine "\$APP_DIR"/);
  assert.match(builder, /codesign --force --deep --sign - "\$APP_DIR"/);
  assert.match(appSource, /i < 5/);
});
