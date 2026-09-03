import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const STORE_VERSION = 1;
export const DEFAULT_FILE_LIMIT_PER_DEVICE = 50;

function validEndpoint(endpoint) {
  return endpoint &&
    typeof endpoint.id === "string" && endpoint.id.length > 0 && endpoint.id.length <= 128 &&
    typeof endpoint.name === "string" && endpoint.name.length > 0 && endpoint.name.length <= 128 &&
    typeof endpoint.type === "string" && endpoint.type.length > 0 && endpoint.type.length <= 32;
}

function validEntry(entry) {
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

function cloneEntry(entry) {
  return { ...entry, source: { ...entry.source }, target: { ...entry.target } };
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

function publicEntry(entry) {
  const presentation = filePresentation(entry.name);
  return { ...cloneEntry(entry), previewKind: presentation.previewKind };
}

export class FileTransferStore {
  #entries;
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
    entries = [],
    now = () => Date.now(),
    idFactory = randomUUID,
    maxFileBytes,
    maxTotalBytes,
    ttlMs,
    limitPerDevice = DEFAULT_FILE_LIMIT_PER_DEVICE
  }) {
    if (typeof stateDir !== "string" || !stateDir) throw new Error("File store stateDir is required.");
    if (!Array.isArray(entries) || !entries.every(validEntry)) throw new Error("Invalid file transfer entries.");
    if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1) throw new Error("maxFileBytes must be a positive integer.");
    if (!Number.isInteger(maxTotalBytes) || maxTotalBytes < maxFileBytes) throw new Error("maxTotalBytes must be at least maxFileBytes.");
    if (!Number.isInteger(ttlMs) || ttlMs < 60_000) throw new Error("ttlMs must be at least one minute.");
    this.#stateDir = stateDir;
    this.#contentDir = path.join(stateDir, "files");
    this.#metadataPath = path.join(stateDir, "files.json");
    this.#entries = entries.map(cloneEntry);
    this.#now = now;
    this.#idFactory = idFactory;
    this.#maxFileBytes = maxFileBytes;
    this.#maxTotalBytes = maxTotalBytes;
    this.#ttlMs = ttlMs;
    this.#limitPerDevice = limitPerDevice;
  }

  list(targetId) {
    return this.#entries
      .filter((entry) => entry.target.id === targetId && Date.parse(entry.expiresAt) > this.#now())
      .slice(0, this.#limitPerDevice)
      .map(publicEntry);
  }

  get(entryId, targetId) {
    const entry = this.#entries.find((item) => item.id === entryId && item.target.id === targetId && Date.parse(item.expiresAt) > this.#now());
    return entry ? publicEntry(entry) : null;
  }

  contentPath(entryId) {
    return path.join(this.#contentDir, `${entryId}.blob`);
  }

  async receive({ stream, name, mimeType = "", declaredBytes = null, source, target }) {
    if (!stream || !validEndpoint(source) || !validEndpoint(target) || source.id === target.id) {
      throw Object.assign(new Error("Invalid file transfer."), { status: 400 });
    }
    if (declaredBytes !== null && (!Number.isInteger(declaredBytes) || declaredBytes < 0)) {
      throw Object.assign(new Error("Invalid Content-Length."), { status: 400 });
    }
    if (declaredBytes !== null && declaredBytes > this.#maxFileBytes) {
      throw Object.assign(new Error(`文件超过 ${this.#maxFileBytes} 字节的上限。`), { status: 413 });
    }
    await this.cleanupExpired();
    const currentBytes = this.#entries.reduce((sum, entry) => sum + entry.bytes, 0);
    if (declaredBytes !== null && currentBytes + this.#activeUploadBytes + declaredBytes > this.#maxTotalBytes) {
      throw Object.assign(new Error("Windows 临时文件空间已满，请先清理文件收件箱。"), { status: 507 });
    }

    await mkdir(this.#contentDir, { recursive: true });
    const id = this.#idFactory();
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) throw new Error("Invalid file id.");
    const partialPath = path.join(this.#contentDir, `${id}.partial`);
    const finalPath = this.contentPath(id);
    let bytes = 0;
    let activeBytesForUpload = 0;
    const hash = createHash("sha256");
    const store = this;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        const storedBytes = store.#entries.reduce((sum, entry) => sum + entry.bytes, 0);
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
    const entry = {
      id,
      kind: "file",
      name: normalizeFileName(name),
      mimeType: String(mimeType ?? "").slice(0, 160),
      bytes,
      sha256: hash.digest("hex"),
      source: { id: source.id, name: source.name, type: source.type },
      target: { id: target.id, name: target.name, type: target.type },
      createdAt,
      expiresAt: new Date(this.#now() + this.#ttlMs).toISOString()
    };
    this.#entries.unshift(entry);
    this.#activeUploadBytes -= activeBytesForUpload;
    await this.#enforceDeviceLimit(target.id);
    await this.#save();
    return publicEntry(entry);
  }

  async remove(entryId, targetId) {
    const index = this.#entries.findIndex((entry) => entry.id === entryId && entry.target.id === targetId);
    if (index === -1) return false;
    const [entry] = this.#entries.splice(index, 1);
    await rm(this.contentPath(entry.id), { force: true });
    await this.#save();
    return true;
  }

  async clear(targetId) {
    const removed = this.#entries.filter((entry) => entry.target.id === targetId);
    if (!removed.length) return 0;
    this.#entries = this.#entries.filter((entry) => entry.target.id !== targetId);
    await Promise.all(removed.map((entry) => rm(this.contentPath(entry.id), { force: true })));
    await this.#save();
    return removed.length;
  }

  async removeForDevice(deviceId) {
    const removed = this.#entries.filter((entry) => entry.source.id === deviceId || entry.target.id === deviceId);
    if (!removed.length) return 0;
    this.#entries = this.#entries.filter((entry) => entry.source.id !== deviceId && entry.target.id !== deviceId);
    await Promise.all(removed.map((entry) => rm(this.contentPath(entry.id), { force: true })));
    await this.#save();
    return removed.length;
  }

  async cleanupExpired() {
    const expired = this.#entries.filter((entry) => Date.parse(entry.expiresAt) <= this.#now());
    if (!expired.length) return 0;
    this.#entries = this.#entries.filter((entry) => Date.parse(entry.expiresAt) > this.#now());
    await Promise.all(expired.map((entry) => rm(this.contentPath(entry.id), { force: true })));
    await this.#save();
    return expired.length;
  }

  createReadStream(entryId) {
    return createReadStream(this.contentPath(entryId));
  }

  async #enforceDeviceLimit(targetId) {
    const forTarget = this.#entries.filter((entry) => entry.target.id === targetId);
    const overflow = forTarget.slice(this.#limitPerDevice);
    if (!overflow.length) return;
    const ids = new Set(overflow.map((entry) => entry.id));
    this.#entries = this.#entries.filter((entry) => !ids.has(entry.id));
    await Promise.all(overflow.map((entry) => rm(this.contentPath(entry.id), { force: true })));
  }

  async #save() {
    const snapshot = this.#entries.map(cloneEntry);
    const persist = async () => {
      await mkdir(this.#stateDir, { recursive: true });
      await writeFile(this.#metadataPath, `${JSON.stringify({ version: STORE_VERSION, entries: snapshot }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    };
    this.#writeQueue = this.#writeQueue.then(persist, persist);
    await this.#writeQueue;
  }
}

export async function loadFileTransferStore(stateDir, options) {
  const metadataPath = path.join(stateDir, "files.json");
  let entries = [];
  try {
    const parsed = JSON.parse(await readFile(metadataPath, "utf8"));
    if (parsed?.version !== STORE_VERSION || !Array.isArray(parsed.entries) || !parsed.entries.every(validEntry)) {
      throw new Error("Invalid file transfer store.");
    }
    entries = parsed.entries;
    const existing = [];
    for (const entry of entries) {
      try {
        const info = await stat(path.join(stateDir, "files", `${entry.id}.blob`));
        if (info.isFile() && info.size === entry.bytes) existing.push(entry);
      } catch {}
    }
    entries = existing;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const store = new FileTransferStore({ stateDir, entries, ...options });
  await store.cleanupExpired();
  return store;
}
