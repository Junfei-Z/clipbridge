import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_VERSION = 1;
export const DEFAULT_INBOX_LIMIT = 50;

function validEndpoint(endpoint) {
  return endpoint &&
    typeof endpoint.id === "string" && endpoint.id.length > 0 && endpoint.id.length <= 128 &&
    typeof endpoint.name === "string" && endpoint.name.length > 0 && endpoint.name.length <= 128 &&
    typeof endpoint.type === "string" && endpoint.type.length > 0 && endpoint.type.length <= 32;
}

function validTransfer(transfer) {
  return transfer &&
    typeof transfer.id === "string" && transfer.id.length > 0 && transfer.id.length <= 128 &&
    transfer.kind === "text" && typeof transfer.text === "string" &&
    Number.isInteger(transfer.bytes) && transfer.bytes >= 0 &&
    validEndpoint(transfer.source) && validEndpoint(transfer.target) &&
    typeof transfer.createdAt === "string" && !Number.isNaN(Date.parse(transfer.createdAt));
}

function cloneTransfer(transfer) {
  return { ...transfer, source: { ...transfer.source }, target: { ...transfer.target } };
}

export class InboxStore {
  #transfers;
  #persist;
  #now;
  #limitPerDevice;
  #idFactory;
  #writeQueue = Promise.resolve();

  constructor({
    transfers = [],
    persist = async () => {},
    now = () => Date.now(),
    limitPerDevice = DEFAULT_INBOX_LIMIT,
    idFactory = randomUUID
  } = {}) {
    if (!Number.isInteger(limitPerDevice) || limitPerDevice < 1 || limitPerDevice > 1000) {
      throw new Error("Inbox limit must be an integer between 1 and 1000.");
    }
    if (!Array.isArray(transfers) || !transfers.every(validTransfer)) {
      throw new Error("Invalid queued transfers.");
    }
    this.#transfers = transfers.map(cloneTransfer);
    this.#persist = persist;
    this.#now = now;
    this.#limitPerDevice = limitPerDevice;
    this.#idFactory = idFactory;
    this.#enforceLimits();
  }

  list(targetId, { limit = this.#limitPerDevice } = {}) {
    if (typeof targetId !== "string" || !targetId) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || this.#limitPerDevice, 1), this.#limitPerDevice);
    return this.#transfers
      .filter((transfer) => transfer.target.id === targetId)
      .slice(0, safeLimit)
      .map(cloneTransfer);
  }

  async deliver({ text, source, target }) {
    if (typeof text !== "string" || !validEndpoint(source) || !validEndpoint(target) || source.id === target.id) {
      throw new Error("Invalid queued transfer.");
    }
    const transfer = {
      id: this.#idFactory(),
      kind: "text",
      text,
      bytes: Buffer.byteLength(text, "utf8"),
      source: { id: source.id, name: source.name, type: source.type },
      target: { id: target.id, name: target.name, type: target.type },
      createdAt: new Date(this.#now()).toISOString()
    };
    this.#transfers.unshift(transfer);
    this.#enforceLimits();
    await this.#save();
    return cloneTransfer(transfer);
  }

  async consume(transferId, targetId) {
    const index = this.#transfers.findIndex((transfer) => transfer.id === transferId && transfer.target.id === targetId);
    if (index === -1) return null;
    const [transfer] = this.#transfers.splice(index, 1);
    await this.#save();
    return cloneTransfer(transfer);
  }

  async clear(targetId) {
    const originalLength = this.#transfers.length;
    this.#transfers = this.#transfers.filter((transfer) => transfer.target.id !== targetId);
    const removed = originalLength - this.#transfers.length;
    if (removed > 0) await this.#save();
    return removed;
  }

  #enforceLimits() {
    const counts = new Map();
    this.#transfers = this.#transfers.filter((transfer) => {
      const count = (counts.get(transfer.target.id) ?? 0) + 1;
      counts.set(transfer.target.id, count);
      return count <= this.#limitPerDevice;
    });
  }

  async #save() {
    const snapshot = this.#transfers.map(cloneTransfer);
    const persist = () => this.#persist(snapshot);
    this.#writeQueue = this.#writeQueue.then(persist, persist);
    await this.#writeQueue;
  }
}

export async function loadInboxStore(stateDir, options = {}) {
  const inboxPath = path.join(stateDir, "inbox.json");
  let transfers = [];
  try {
    const parsed = JSON.parse(await readFile(inboxPath, "utf8"));
    if (parsed?.version !== STORE_VERSION || !Array.isArray(parsed.transfers) || !parsed.transfers.every(validTransfer)) {
      throw new Error("Invalid inbox store.");
    }
    transfers = parsed.transfers;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const persist = async (nextTransfers) => {
    await mkdir(stateDir, { recursive: true });
    const payload = `${JSON.stringify({ version: STORE_VERSION, transfers: nextTransfers }, null, 2)}\n`;
    await writeFile(inboxPath, payload, { encoding: "utf8", mode: 0o600 });
  };

  return new InboxStore({
    transfers,
    persist,
    now: options.now,
    limitPerDevice: options.limitPerDevice,
    idFactory: options.idFactory
  });
}
