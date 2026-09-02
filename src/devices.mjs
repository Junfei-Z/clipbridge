import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_VERSION = 1;
const LAST_SEEN_WRITE_INTERVAL_MS = 30_000;

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeHashEqual(left, right) {
  const leftBuffer = Buffer.from(left ?? "", "hex");
  const rightBuffer = Buffer.from(right ?? "", "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function publicDevice(device) {
  return {
    id: device.id,
    name: device.name,
    type: device.type,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt
  };
}

function validateStoredDevice(device) {
  return device &&
    typeof device.id === "string" &&
    typeof device.name === "string" && device.name.length > 0 && device.name.length <= 48 &&
    ["iphone", "ipad", "android", "mac", "windows", "other"].includes(device.type) &&
    typeof device.tokenHash === "string" && /^[a-f0-9]{64}$/.test(device.tokenHash) &&
    typeof device.createdAt === "string" &&
    typeof device.lastSeenAt === "string";
}

export class DeviceRegistry {
  #devices;
  #persist;
  #now;
  #writeQueue = Promise.resolve();

  constructor({ devices = [], persist = async () => {}, now = () => Date.now() } = {}) {
    this.#devices = devices;
    this.#persist = persist;
    this.#now = now;
  }

  list() {
    return this.#devices
      .map(publicDevice)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  get(deviceId) {
    const device = this.#devices.find((candidate) => candidate.id === deviceId);
    return device ? publicDevice(device) : null;
  }

  async authenticate(token) {
    if (typeof token !== "string" || token.length < 32) return null;
    const hash = tokenHash(token);
    const device = this.#devices.find((candidate) => safeHashEqual(candidate.tokenHash, hash));
    if (!device) return null;
    const timestamp = this.#now();
    if (timestamp - Date.parse(device.lastSeenAt) >= LAST_SEEN_WRITE_INTERVAL_MS) {
      device.lastSeenAt = new Date(timestamp).toISOString();
      await this.#save();
    }
    return publicDevice(device);
  }

  async register({ name, type }) {
    const token = randomBytes(32).toString("base64url");
    const timestamp = new Date(this.#now()).toISOString();
    const device = {
      id: randomUUID(),
      name: normalizeDeviceName(name),
      type: normalizeDeviceType(type),
      tokenHash: tokenHash(token),
      createdAt: timestamp,
      lastSeenAt: timestamp
    };
    this.#devices.push(device);
    await this.#save();
    return { token, device: publicDevice(device) };
  }

  async revoke(deviceId) {
    const originalLength = this.#devices.length;
    this.#devices = this.#devices.filter((device) => device.id !== deviceId);
    if (this.#devices.length === originalLength) return false;
    await this.#save();
    return true;
  }

  async #save() {
    const snapshot = this.#devices.map((device) => ({ ...device }));
    const write = this.#writeQueue.then(
      () => this.#persist(snapshot),
      () => this.#persist(snapshot)
    );
    this.#writeQueue = write.catch(() => {});
    await write;
  }
}

export async function loadDeviceRegistry(stateDir, options = {}) {
  const devicesPath = path.join(stateDir, "devices.json");
  let devices = [];
  try {
    const parsed = JSON.parse(await readFile(devicesPath, "utf8"));
    if (parsed?.version !== STORE_VERSION || !Array.isArray(parsed.devices) || !parsed.devices.every(validateStoredDevice)) {
      throw new Error("Invalid paired-device store.");
    }
    devices = parsed.devices;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const persist = async (nextDevices) => {
    await mkdir(stateDir, { recursive: true });
    const payload = `${JSON.stringify({ version: STORE_VERSION, devices: nextDevices }, null, 2)}\n`;
    await writeFile(devicesPath, payload, { encoding: "utf8", mode: 0o600 });
  };

  return new DeviceRegistry({ devices, persist, now: options.now });
}

export function normalizeDeviceName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name) throw Object.assign(new Error("请输入设备名称。"), { status: 400 });
  if (name.length > 48) throw Object.assign(new Error("设备名称不能超过 48 个字符。"), { status: 400 });
  return name;
}

export function normalizeDeviceType(value) {
  const supported = new Set(["iphone", "ipad", "android", "mac", "windows", "other"]);
  return supported.has(value) ? value : "other";
}
