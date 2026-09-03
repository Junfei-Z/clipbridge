import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { FileTransferStore, filePresentation, loadFileTransferStore, normalizeFileName } from "../src/files.mjs";

const ANDROID = { id: "android", name: "Android 手机", type: "android" };
const IPHONE = { id: "iphone", name: "iPhone", type: "iphone" };
const MAC = { id: "mac", name: "MacBook", type: "mac" };

test("streams files to disk, isolates targets, and preserves Unicode names", async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "clipbridge-files-"));
  try {
    const store = new FileTransferStore({
      stateDir,
      maxFileBytes: 1024,
      maxTotalBytes: 4096,
      ttlMs: 60_000,
      idFactory: () => "file-1"
    });
    const content = Buffer.from("你好，文件 🥳", "utf8");
    const entry = await store.receive({
      stream: Readable.from(content),
      name: "测试/文件.svg",
      mimeType: "image/svg+xml",
      declaredBytes: content.length,
      source: ANDROID,
      target: IPHONE
    });

    assert.equal(entry.name, "测试_文件.svg");
    assert.equal(entry.bytes, content.length);
    assert.equal(entry.previewKind, "text");
    assert.deepEqual(store.list(ANDROID.id), []);
    assert.equal(store.list(IPHONE.id)[0].source.id, ANDROID.id);
    assert.deepEqual(await readFile(store.contentPath(entry.id)), content);

    const reloaded = await loadFileTransferStore(stateDir, {
      maxFileBytes: 1024,
      maxTotalBytes: 4096,
      ttlMs: 60_000
    });
    assert.equal(reloaded.list(IPHONE.id)[0].name, "测试_文件.svg");
    assert.equal(await reloaded.remove(entry.id, ANDROID.id), false);
    assert.equal(await reloaded.remove(entry.id, IPHONE.id), true);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("rejects oversized files and removes partial content", async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "clipbridge-files-limit-"));
  try {
    const store = new FileTransferStore({ stateDir, maxFileBytes: 4, maxTotalBytes: 8, ttlMs: 60_000, idFactory: () => "large" });
    await assert.rejects(
      store.receive({ stream: Readable.from(Buffer.from("12345")), name: "large.bin", source: ANDROID, target: IPHONE }),
      (error) => error.status === 413
    );
    assert.deepEqual(store.list(IPHONE.id), []);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("shares one blob across targets while keeping delivery state independent", async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "clipbridge-files-multicast-"));
  try {
    const store = new FileTransferStore({
      stateDir,
      maxFileBytes: 1024,
      maxTotalBytes: 4096,
      ttlMs: 60_000,
      idFactory: () => "shared-blob"
    });
    const batch = await store.receive({
      stream: Readable.from("one upload"),
      name: "shared.pdf",
      source: ANDROID,
      targets: [IPHONE, MAC]
    });

    assert.equal(batch.deliveries.length, 2);
    assert.equal(batch.deliveries[0].blobId, batch.deliveries[1].blobId);
    assert.notEqual(batch.deliveries[0].id, batch.deliveries[1].id);
    const metadata = JSON.parse(await readFile(path.join(stateDir, "files.json"), "utf8"));
    assert.equal(metadata.version, 2);
    assert.equal(metadata.blobs.length, 1);
    assert.equal(metadata.deliveries.length, 2);

    await store.markDownloaded(batch.deliveries[0].id, IPHONE.id);
    const outbox = store.listBySource(ANDROID.id)[0];
    assert.deepEqual(outbox.deliveries.map(({ status }) => status), ["downloaded", "pending"]);

    assert.equal(await store.remove(batch.deliveries[0].id, IPHONE.id), true);
    assert.equal(store.list(MAC.id).length, 1);
    assert.equal((await readFile(store.contentPath(batch.blobId), "utf8")), "one upload");
    assert.equal(await store.remove(batch.deliveries[1].id, MAC.id), true);
    await assert.rejects(readFile(store.contentPath(batch.blobId)), (error) => error.code === "ENOENT");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("loads v0.4 single-target metadata as a shared-blob store", async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "clipbridge-files-migration-"));
  try {
    await mkdir(path.join(stateDir, "files"), { recursive: true });
    const content = Buffer.from("legacy blob");
    await writeFile(path.join(stateDir, "files", "legacy-1.blob"), content);
    await writeFile(path.join(stateDir, "files.json"), JSON.stringify({
      version: 1,
      entries: [{
        id: "legacy-1",
        kind: "file",
        name: "旧文件.txt",
        mimeType: "text/plain",
        bytes: content.length,
        sha256: "0".repeat(64),
        source: ANDROID,
        target: IPHONE,
        createdAt: "2026-09-03T00:00:00.000Z",
        expiresAt: "2026-09-03T01:00:00.000Z"
      }]
    }));

    const store = await loadFileTransferStore(stateDir, {
      now: () => Date.parse("2026-09-03T00:30:00Z"),
      maxFileBytes: 1024,
      maxTotalBytes: 4096,
      ttlMs: 60_000
    });
    const entry = store.list(IPHONE.id)[0];
    assert.equal(entry.id, "legacy-1");
    assert.equal(entry.blobId, "legacy-1");
    assert.equal(entry.status, "pending");
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("expires files and clears transfers involving a revoked device", async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), "clipbridge-files-expiry-"));
  let clock = Date.parse("2026-09-03T00:00:00Z");
  let sequence = 0;
  try {
    const store = new FileTransferStore({
      stateDir,
      now: () => clock,
      maxFileBytes: 1024,
      maxTotalBytes: 4096,
      ttlMs: 60_000,
      idFactory: () => `file-${++sequence}`
    });
    const first = await store.receive({ stream: Readable.from("first"), name: "first.txt", source: ANDROID, target: IPHONE });
    await store.receive({ stream: Readable.from("second"), name: "second.txt", source: IPHONE, target: ANDROID });
    assert.equal(await store.removeForDevice(ANDROID.id), 2);
    assert.deepEqual(store.list(IPHONE.id), []);

    const expiring = await store.receive({ stream: Readable.from("expires"), name: "expires.txt", source: ANDROID, target: IPHONE });
    clock += 60_001;
    assert.equal(await store.cleanupExpired(), 1);
    assert.equal(store.get(expiring.id, IPHONE.id), null);
    await assert.rejects(readFile(store.contentPath(expiring.id)), (error) => error.code === "ENOENT");
    assert.notEqual(first.id, expiring.id);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("classifies previewable files without executing SVG or code", () => {
  assert.equal(filePresentation("photo.png").previewKind, "image");
  assert.equal(filePresentation("document.pdf").previewKind, "pdf");
  assert.deepEqual(filePresentation("untrusted.svg"), { previewKind: "text", contentType: "text/plain; charset=utf-8" });
  assert.equal(filePresentation("archive.zip").previewKind, null);
  assert.equal(normalizeFileName("../secret.txt"), ".._secret.txt");
});
