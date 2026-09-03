import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const STORE_VERSION = 2;
const LEGACY_STORE_VERSION = 1;
const DELIVERY_STATUSES = new Set(["pending", "downloaded"]);
export const DEFAULT_FILE_LIMIT_PER_DEVICE = 50;
export const MAX_FILE_TARGETS = 32;

function validEndpoint(endpoint) {
  return endpoint &&
    typeof endpoint.id === "string" && endpoint.id.length > 0 && endpoint.id.length <= 128 &&
    typeof endpoint.name === "string" && endpoint.name.length > 0 && endpoint.name.length <= 128 &&
    typeof endpoint.type === "string" && endpoint.type.length > 0 && endpoint.type.length <= 32;
}

function validBlob(blob) {
  return blob &&
    typeof blob.id === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(blob.id) &&
    blob.kind === "file-blob" &&
    typeof blob.name === "string" && blob.name.length > 0 && blob.name.length <= 255 &&
    typeof blob.mimeType === "string" && blob.mimeType.length <= 160 &&
    Number.isInteger(blob.bytes) && blob.bytes >= 0 &&
    typeof blob.sha256 === "string" && /^[a-f0-9]{64}$/.test(blob.sha256) &&
    validEndpoint(blob.source) &&
    typeof blob.createdAt === "string" && !Number.isNaN(Date.parse(blob.createdAt)) &&
    typeof blob.expiresAt === "string" && !Number.isNaN(Date.parse(blob.expiresAt));
}

function validDelivery(delivery) {
  return delivery &&
    typeof delivery.id === "string" && /^[a-zA-Z0-9-]{1,160}$/.test(delivery.id) &&
    typeof delivery.blobId === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(delivery.blobId) &&
    validEndpoint(delivery.target) &&
    DELIVERY_STATUSES.has(delivery.status) &&
    (delivery.downloadedAt === null ||
      (typeof delivery.downloadedAt === "string" && !Number.isNaN(Date.parse(delivery.downloadedAt))));
}

function validLegacyEntry(entry) {
  return entry &&
    typeof entry.id === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(entry.id) &&
    entry.kind === "file" &&
    typeof entry.name === "string" && entry.name.length > 0 && entry.name.length <= 255 &&
    typeof entry.mimeType === "string" && entry.mimeType.length <= 160 &&
    Number.isInteger(entry.bytes) && entry.bytes >= 0 &&
    typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/.test(entry.sha256) &&
    validEndpoint(entry.source) && validEndpoint(entry.target) &&
    typeof entry.createdAt === "string" && !Number.isNaN(Date.parse(entry.createdAt)) &&
    typeof entry.expiresAt === "string" && !Number.isNaN(Date.parse(entry.expiresAt));
}

function cloneEndpoint(endpoint) {
  return { id: endpoint.id, name: endpoint.name, type: endpoint.type };
}

function cloneBlob(blob) {
  return { ...blob, source: cloneEndpoint(blob.source) };
}

function cloneDelivery(delivery) {
  return { ...delivery, target: cloneEndpoint(delivery.target) };
}

export function normalizeFileName(value) {
  const cleaned = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "未命名文件";
  return cleaned.slice(0, 255);
}

export function filePresentation(name) {
  const extension = path.extname(String(name)).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(extension)) {
    return { previewKind: "image", contentType: extension === ".png" ? "image/png" : extension === ".gif" ? "image/gif" : extension === ".webp" ? "image/webp" : extension === ".avif" ? "image/avif" : "image/jpeg" };
  }
  if ([".mp4", ".m4v", ".mov", ".webm"].includes(extension)) {
    return { previewKind: "video", contentType: extension === ".webm" ? "video/webm" : extension === ".mov" ? "video/quicktime" : "video/mp4" };
  }
  if (extension === ".pdf") return { previewKind: "pdf", contentType: "application/pdf" };
  if ([".txt", ".md", ".markdown", ".json", ".jsonl", ".xml", ".csv", ".tsv", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".css", ".html", ".htm", ".py", ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".go", ".rs", ".swift", ".kt", ".kts", ".sh", ".ps1", ".yml", ".yaml", ".toml", ".ini", ".conf", ".log", ".svg"].includes(extension)) {
    return { previewKind: "text", contentType: "text/plain; charset=utf-8" };
  }
  return { previewKind: null, contentType: "application/octet-stream" };
}

function publicEntry(blob, delivery) {
  const presentation = filePresentation(blob.name);
  return {
    id: delivery.id,
    blobId: blob.id,
    kind: "file",
    name: blob.name,
    mimeType: blob.mimeType,
    bytes: blob.bytes,
    sha256: blob.sha256,
    source: cloneEndpoint(blob.source),
    target: cloneEndpoint(delivery.target),
    status: delivery.status,
    downloadedAt: delivery.downloadedAt,
    createdAt: blob.createdAt,
    expiresAt: blob.expiresAt,
    previewKind: presentation.previewKind
  };
}

export class FileTransferStore {
  #blobs;
  #deliveries;
  #stateDir;
  #contentDir;
  #metadataPath;
  #now;
  #idFactory;
  #maxFileBytes;
  #maxTotalBytes;
  #ttlMs;
  #limitPerDevice;
  #activeUploadBytes = 0;
  #writeQueue = Promise.resolve();

  constructor({
    stateDir,
    blobs = [],
    deliveries = [],
    now = () => Date.now(),
    idFactory = randomUUID,
    maxFileBytes,
    maxTotalBytes,
    ttlMs,
    limitPerDevice = DEFAULT_FILE_LIMIT_PER_DEVICE
  }) {
    if (typeof stateDir !== "string" || !stateDir) throw new Error("File store stateDir is required.");
    if (!Array.isArray(blobs) || !blobs.every(validBlob)) throw new Error("Invalid file blobs.");
    if (!Array.isArray(deliveries) || !deliveries.every(validDelivery)) throw new Error("Invalid file deliveries.");
    const blobIds = new Set(blobs.map(({ id }) => id));
    if (!deliveries.every(({ blobId }) => blobIds.has(blobId))) throw new Error("A file delivery references a missing blob.");
    if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1) throw new Error("maxFileBytes must be a positive integer.");
    if (!Number.isInteger(maxTotalBytes) || maxTotalBytes < maxFileBytes) throw new Error("maxTotalBytes must be at least maxFileBytes.");
    if (!Number.isInteger(ttlMs) || ttlMs < 60_000) throw new Error("ttlMs must be at least one minute.");
    this.#stateDir = stateDir;
    this.#contentDir = path.join(stateDir, "files");
    this.#metadataPath = path.join(stateDir, "files.json");
    this.#blobs = blobs.map(cloneBlob);
    this.#deliveries = deliveries.map(cloneDelivery);
    this.#now = now;
    this.#idFactory = idFactory;
    this.#maxFileBytes = maxFileBytes;
    this.#maxTotalBytes = maxTotalBytes;
    this.#ttlMs = ttlMs;
    this.#limitPerDevice = limitPerDevice;
  }

  list(targetId) {
    return this.#deliveries
      .filter((delivery) => delivery.target.id === targetId)
      .map((delivery) => ({ delivery, blob: this.#blobs.find(({ id }) => id === delivery.blobId) }))
      .filter(({ blob }) => blob && Date.parse(blob.expiresAt) > this.#now())
      .sort((left, right) => Date.parse(right.blob.createdAt) - Date.parse(left.blob.createdAt))
      .slice(0, this.#limitPerDevice)
      .map(({ blob, delivery }) => publicEntry(blob, delivery));
  }

  listBySource(sourceId) {
    return this.#blobs
      .filter((blob) => blob.source.id === sourceId && Date.parse(blob.expiresAt) > this.#now())
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((blob) => ({
        blobId: blob.id,
        kind: "file",
        name: blob.name,
        mimeType: blob.mimeType,
        bytes: blob.bytes,
        sha256: blob.sha256,
        source: cloneEndpoint(blob.source),
        createdAt: blob.createdAt,
        expiresAt: blob.expiresAt,
        deliveries: this.#deliveries
          .filter(({ blobId }) => blobId === blob.id)
          .map((delivery) => ({
            id: delivery.id,
            target: cloneEndpoint(delivery.target),
            status: delivery.status,
            downloadedAt: delivery.downloadedAt
          }))
      }));
  }

  get(deliveryId, targetId) {
    const delivery = this.#deliveries.find((item) => item.id === deliveryId && item.target.id === targetId);
    if (!delivery) return null;
    const blob = this.#blobs.find(({ id }) => id === delivery.blobId);
    if (!blob || Date.parse(blob.expiresAt) <= this.#now()) return null;
    return publicEntry(blob, delivery);
  }

  contentPath(blobId) {
    return path.join(this.#contentDir, `${blobId}.blob`);
  }

  async receive({ stream, name, mimeType = "", declaredBytes = null, source, target = null, targets = null }) {
    const requestedTargets = Array.isArray(targets) ? targets : target ? [target] : [];
    const uniqueTargets = [...new Map(requestedTargets.map((item) => [item?.id, item])).values()];
    if (!stream || !validEndpoint(source) || uniqueTargets.length < 1 || uniqueTargets.length > MAX_FILE_TARGETS ||
      !uniqueTargets.every((item) => validEndpoint(item) && item.id !== source.id)) {
      throw Object.assign(new Error("Invalid file transfer."), { status: 400 });
    }
    if (declaredBytes !== null && (!Number.isInteger(declaredBytes) || declaredBytes < 0)) {
      throw Object.assign(new Error("Invalid Content-Length."), { status: 400 });
    }
    if (declaredBytes !== null && declaredBytes > this.#maxFileBytes) {
      throw Object.assign(new Error(`文件超过 ${this.#maxFileBytes} 字节的上限。`), { status: 413 });
    }
    await this.cleanupExpired();
    const currentBytes = this.#blobs.reduce((sum, blob) => sum + blob.bytes, 0);
    if (declaredBytes !== null && currentBytes + this.#activeUploadBytes + declaredBytes > this.#maxTotalBytes) {
      throw Object.assign(new Error("Windows 临时文件空间已满，请先清理文件收件箱。"), { status: 507 });
    }

    await mkdir(this.#contentDir, { recursive: true });
    const blobId = this.#idFactory();
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(blobId) || this.#blobs.some(({ id }) => id === blobId)) throw new Error("Invalid or duplicate file id.");
    const partialPath = path.join(this.#contentDir, `${blobId}.partial`);
    const finalPath = this.contentPath(blobId);
    let bytes = 0;
    let activeBytesForUpload = 0;
    const hash = createHash("sha256");
    const store = this;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        const storedBytes = store.#blobs.reduce((sum, blob) => sum + blob.bytes, 0);
        if (bytes > store.#maxFileBytes || storedBytes + store.#activeUploadBytes + chunk.length > store.#maxTotalBytes) {
          callback(Object.assign(new Error("文件过大或临时文件空间不足。"), { status: 413 }));
          return;
        }
        activeBytesForUpload += chunk.length;
        store.#activeUploadBytes += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      }
    });

    try {
      await pipeline(stream, meter, createWriteStream(partialPath, { flags: "wx", mode: 0o600 }));
      if (declaredBytes !== null && bytes !== declaredBytes) {
        throw Object.assign(new Error("文件长度与 Content-Length 不一致。"), { status: 400 });
      }
      await rename(partialPath, finalPath);
    } catch (error) {
      this.#activeUploadBytes -= activeBytesForUpload;
      await rm(partialPath, { force: true });
      throw error;
    }

    const createdAt = new Date(this.#now()).toISOString();
    const blob = {
      id: blobId,
      kind: "file-blob",
      name: normalizeFileName(name),
      mimeType: String(mimeType ?? "").slice(0, 160),
      bytes,
      sha256: hash.digest("hex"),
      source: cloneEndpoint(source),
      createdAt,
      expiresAt: new Date(this.#now() + this.#ttlMs).toISOString()
    };
    const deliveries = uniqueTargets.map((item, index) => ({
      id: index === 0 ? blobId : `${blobId}-${index + 1}`,
      blobId,
      target: cloneEndpoint(item),
      status: "pending",
      downloadedAt: null
    }));
    this.#blobs.unshift(blob);
    this.#deliveries.unshift(...deliveries);
    this.#activeUploadBytes -= activeBytesForUpload;
    for (const item of uniqueTargets) await this.#enforceDeviceLimit(item.id);
    await this.#save();
    const publicDeliveries = deliveries
      .map((delivery) => this.#deliveries.find(({ id }) => id === delivery.id))
      .filter(Boolean)
      .map((delivery) => publicEntry(blob, delivery));
    return { ...publicDeliveries[0], blobId, deliveries: publicDeliveries };
  }

  async markDownloaded(deliveryId, targetId) {
    const delivery = this.#deliveries.find((item) => item.id === deliveryId && item.target.id === targetId);
    if (!delivery) return null;
    const blob = this.#blobs.find(({ id }) => id === delivery.blobId);
    if (!blob || Date.parse(blob.expiresAt) <= this.#now()) return null;
    if (delivery.status !== "downloaded") {
      delivery.status = "downloaded";
      delivery.downloadedAt = new Date(this.#now()).toISOString();
      await this.#save();
    }
    return publicEntry(blob, delivery);
  }

  async remove(deliveryId, targetId) {
    const index = this.#deliveries.findIndex((delivery) => delivery.id === deliveryId && delivery.target.id === targetId);
    if (index === -1) return false;
    const [delivery] = this.#deliveries.splice(index, 1);
    await this.#deleteBlobIfOrphaned(delivery.blobId);
    await this.#save();
    return true;
  }

  async clear(targetId) {
    const removed = this.#deliveries.filter((delivery) => delivery.target.id === targetId);
    if (!removed.length) return 0;
    this.#deliveries = this.#deliveries.filter((delivery) => delivery.target.id !== targetId);
    for (const blobId of new Set(removed.map(({ blobId }) => blobId))) await this.#deleteBlobIfOrphaned(blobId);
    await this.#save();
    return removed.length;
  }

  async removeForDevice(deviceId) {
    const sourceBlobIds = new Set(this.#blobs.filter((blob) => blob.source.id === deviceId).map(({ id }) => id));
    const removed = this.#deliveries.filter((delivery) => delivery.target.id === deviceId || sourceBlobIds.has(delivery.blobId));
    this.#deliveries = this.#deliveries.filter((delivery) => delivery.target.id !== deviceId && !sourceBlobIds.has(delivery.blobId));
    for (const blobId of new Set([...sourceBlobIds, ...removed.map(({ blobId }) => blobId)])) await this.#deleteBlobIfOrphaned(blobId);
    if (removed.length || sourceBlobIds.size) await this.#save();
    return removed.length;
  }

  async cleanupExpired() {
    const expired = this.#blobs.filter((blob) => Date.parse(blob.expiresAt) <= this.#now());
    if (!expired.length) return 0;
    const ids = new Set(expired.map(({ id }) => id));
    this.#blobs = this.#blobs.filter((blob) => !ids.has(blob.id));
    this.#deliveries = this.#deliveries.filter((delivery) => !ids.has(delivery.blobId));
    await Promise.all(expired.map((blob) => rm(this.contentPath(blob.id), { force: true })));
    await this.#save();
    return expired.length;
  }

  createReadStream(blobId) {
    return createReadStream(this.contentPath(blobId));
  }

  async #enforceDeviceLimit(targetId) {
    const forTarget = this.#deliveries
      .filter((delivery) => delivery.target.id === targetId)
      .map((delivery) => ({ delivery, blob: this.#blobs.find(({ id }) => id === delivery.blobId) }))
      .filter(({ blob }) => blob)
      .sort((left, right) => Date.parse(right.blob.createdAt) - Date.parse(left.blob.createdAt));
    const overflow = forTarget.slice(this.#limitPerDevice).map(({ delivery }) => delivery);
    if (!overflow.length) return;
    const ids = new Set(overflow.map(({ id }) => id));
    this.#deliveries = this.#deliveries.filter((delivery) => !ids.has(delivery.id));
    for (const blobId of new Set(overflow.map(({ blobId }) => blobId))) await this.#deleteBlobIfOrphaned(blobId);
  }

  async #deleteBlobIfOrphaned(blobId) {
    if (this.#deliveries.some((delivery) => delivery.blobId === blobId)) return false;
    const index = this.#blobs.findIndex((blob) => blob.id === blobId);
    if (index === -1) return false;
    this.#blobs.splice(index, 1);
    await rm(this.contentPath(blobId), { force: true });
    return true;
  }

  async #save() {
    const snapshot = {
      version: STORE_VERSION,
      blobs: this.#blobs.map(cloneBlob),
      deliveries: this.#deliveries.map(cloneDelivery)
    };
    const persist = async () => {
      await mkdir(this.#stateDir, { recursive: true });
      await writeFile(this.#metadataPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    };
    this.#writeQueue = this.#writeQueue.then(persist, persist);
    await this.#writeQueue;
  }
}

export async function loadFileTransferStore(stateDir, options) {
  const metadataPath = path.join(stateDir, "files.json");
  let blobs = [];
  let deliveries = [];
  try {
    const parsed = JSON.parse(await readFile(metadataPath, "utf8"));
    if (parsed?.version === LEGACY_STORE_VERSION && Array.isArray(parsed.entries) && parsed.entries.every(validLegacyEntry)) {
      blobs = parsed.entries.map((entry) => ({
        id: entry.id,
        kind: "file-blob",
        name: entry.name,
        mimeType: entry.mimeType,
        bytes: entry.bytes,
        sha256: entry.sha256,
        source: cloneEndpoint(entry.source),
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt
      }));
      deliveries = parsed.entries.map((entry) => ({
        id: entry.id,
        blobId: entry.id,
        target: cloneEndpoint(entry.target),
        status: "pending",
        downloadedAt: null
      }));
    } else if (parsed?.version === STORE_VERSION && Array.isArray(parsed.blobs) && parsed.blobs.every(validBlob) &&
      Array.isArray(parsed.deliveries) && parsed.deliveries.every(validDelivery)) {
      blobs = parsed.blobs;
      deliveries = parsed.deliveries;
    } else {
      throw new Error("Invalid file transfer store.");
    }

    const existing = [];
    for (const blob of blobs) {
      try {
        const info = await stat(path.join(stateDir, "files", `${blob.id}.blob`));
        if (info.isFile() && info.size === blob.bytes) existing.push(blob);
      } catch {}
    }
    const existingIds = new Set(existing.map(({ id }) => id));
    blobs = existing;
    deliveries = deliveries.filter(({ blobId }) => existingIds.has(blobId));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const store = new FileTransferStore({ stateDir, blobs, deliveries, ...options });
  await store.cleanupExpired();
  return store;
}
