import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_VERSION = 1;
export const DEFAULT_HISTORY_LIMIT = 50;

function validateEndpoint(endpoint) {
  return endpoint &&
    typeof endpoint.id === "string" && endpoint.id.length > 0 && endpoint.id.length <= 128 &&
    typeof endpoint.name === "string" && endpoint.name.length > 0 && endpoint.name.length <= 128 &&
    typeof endpoint.type === "string" && endpoint.type.length > 0 && endpoint.type.length <= 32;
}

function validateEntry(entry) {
  return entry &&
    typeof entry.id === "string" && entry.id.length > 0 && entry.id.length <= 128 &&
    entry.kind === "text" &&
    typeof entry.text === "string" &&
    Number.isInteger(entry.bytes) && entry.bytes >= 0 &&
    validateEndpoint(entry.source) &&
    validateEndpoint(entry.target) &&
    typeof entry.createdAt === "string" && !Number.isNaN(Date.parse(entry.createdAt));
}

function cloneEntry(entry) {
  return {
    ...entry,
    source: { ...entry.source },
    target: { ...entry.target }
  };
}

function involvesDevice(entry, deviceId) {
  return !deviceId || entry.source.id === deviceId || entry.target.id === deviceId;
}

export class HistoryStore {
  #entries;
  #persist;
  #now;
  #limit;
  #idFactory;
  #writeQueue = Promise.resolve();

  constructor({
    entries = [],
    persist = async () => {},
    now = () => Date.now(),
    limit = DEFAULT_HISTORY_LIMIT,
    idFactory = randomUUID
  } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error("History limit must be an integer between 1 and 1000.");
    }
    if (!Array.isArray(entries) || !entries.every(validateEntry)) {
      throw new Error("Invalid clipboard history entries.");
    }
    this.#entries = entries.slice(0, limit).map(cloneEntry);
    this.#persist = persist;
    this.#now = now;
    this.#limit = limit;
    this.#idFactory = idFactory;
  }

  list({ deviceId = null, limit = this.#limit } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || this.#limit, 1), this.#limit);
    return this.#entries
      .filter((entry) => involvesDevice(entry, deviceId))
      .slice(0, safeLimit)
      .map(cloneEntry);
  }

  async add({ text, source, target }) {
    if (typeof text !== "string" || !validateEndpoint(source) || !validateEndpoint(target)) {
      throw new Error("Invalid clipboard history entry.");
    }
    const entry = {
      id: this.#idFactory(),
      kind: "text",
      text,
      bytes: Buffer.byteLength(text, "utf8"),
      source: { id: source.id, name: source.name, type: source.type },
      target: { id: target.id, name: target.name, type: target.type },
      createdAt: new Date(this.#now()).toISOString()
    };
    this.#entries.unshift(entry);
    this.#entries = this.#entries.slice(0, this.#limit);
    await this.#save();
    return cloneEntry(entry);
  }

  async remove(entryId, { deviceId = null } = {}) {
    const index = this.#entries.findIndex((entry) => entry.id === entryId && involvesDevice(entry, deviceId));
    if (index === -1) return false;
    this.#entries.splice(index, 1);
    await this.#save();
    return true;
  }

  async clear({ deviceId = null } = {}) {
    const originalLength = this.#entries.length;
    this.#entries = deviceId
      ? this.#entries.filter((entry) => !involvesDevice(entry, deviceId))
      : [];
    const removed = originalLength - this.#entries.length;
    if (removed > 0) await this.#save();
    return removed;
  }

  async #save() {
    const snapshot = this.#entries.map(cloneEntry);
    const persist = () => this.#persist(snapshot);
    this.#writeQueue = this.#writeQueue.then(persist, persist);
    await this.#writeQueue;
  }
}

export async function loadHistoryStore(stateDir, options = {}) {
  const historyPath = path.join(stateDir, "history.json");
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  let entries = [];
  try {
    const parsed = JSON.parse(await readFile(historyPath, "utf8"));
    if (parsed?.version !== STORE_VERSION || !Array.isArray(parsed.entries) || !parsed.entries.every(validateEntry)) {
      throw new Error("Invalid clipboard history store.");
    }
    entries = parsed.entries;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const persist = async (nextEntries) => {
    await mkdir(stateDir, { recursive: true });
    const payload = `${JSON.stringify({ version: STORE_VERSION, entries: nextEntries }, null, 2)}\n`;
    await writeFile(historyPath, payload, { encoding: "utf8", mode: 0o600 });
  };

  return new HistoryStore({ entries, persist, now: options.now, limit, idFactory: options.idFactory });
}
