#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = resolve(new URL("..", import.meta.url).pathname);
const assets = join(root, "assets");
const master = join(assets, "clipbridge-icon-master.png");
const temp = await mkdtemp(join(tmpdir(), "clipbridge-icons-"));

async function png(size, output) {
  await exec("sips", ["-z", String(size), String(size), master, "--out", output]);
}

async function ico(output, sizes) {
  const images = [];
  for (const size of sizes) {
    const source = join(temp, `ico-${size}.png`);
    await png(size, source);
    images.push({ size, data: await readFile(source) });
  }
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size; header[entry + 1] = size === 256 ? 0 : size;
    header[entry + 2] = 0; header[entry + 3] = 0;
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  await writeFile(output, Buffer.concat([header, ...images.map(({ data }) => data)]));
}

try {
  for (const [size, name] of [[16, "favicon-16.png"], [32, "favicon-32.png"], [96, "brand-icon-96.png"], [180, "apple-touch-icon.png"], [192, "brand-icon-192.png"], [192, "icon-192.png"], [512, "icon-512.png"]]) await png(size, join(assets, name));
  await ico(join(assets, "favicon.ico"), [16, 32, 48]);
  await ico(join(assets, "clipbridge-tray.ico"), [16, 20, 24, 32, 40, 48, 64, 128, 256]);
  const iconset = join(temp, "ClipBridge.iconset"); await mkdir(iconset);
  for (const [size, name] of [[16, "icon_16x16.png"], [32, "icon_16x16@2x.png"], [32, "icon_32x32.png"], [64, "icon_32x32@2x.png"], [128, "icon_128x128.png"], [256, "icon_128x128@2x.png"], [256, "icon_256x256.png"], [512, "icon_256x256@2x.png"], [512, "icon_512x512.png"], [1024, "icon_512x512@2x.png"]]) await png(size, join(iconset, name));
  await exec("iconutil", ["-c", "icns", iconset, "-o", join(assets, "ClipBridge.icns")]);
  console.log("ClipBridge icon assets rebuilt.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
