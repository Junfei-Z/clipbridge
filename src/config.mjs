import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { relayTypeForPlatform } from "./identity.mjs";

export const DEFAULT_PORT = 39393;
export const DEFAULT_MAX_TEXT_BYTES = 64 * 1024;
export const DEFAULT_MAX_FILE_BYTES = 256 * 1024 * 1024;
export const DEFAULT_MAX_FILE_TOTAL_BYTES = 1024 * 1024 * 1024;
export const DEFAULT_FILE_TTL_MS = 24 * 60 * 60 * 1000;

function fileDefaults() {
  return {
    maxFileBytes: DEFAULT_MAX_FILE_BYTES,
    maxFileTotalBytes: DEFAULT_MAX_FILE_TOTAL_BYTES,
    fileTtlMs: DEFAULT_FILE_TTL_MS
  };
}

function defaultNodeName(platform, hostname, environment) {
  const candidate = platform === "win32"
    ? environment.COMPUTERNAME || hostname || "Windows PC"
    : platform === "darwin"
      ? hostname || "Mac"
      : hostname || "ClipBridge relay";
  return String(candidate).trim().replace(/\s+/g, " ").slice(0, 48);
}

function migrateConfig(parsed, { platform, hostname }) {
  const nodePlatform = parsed.nodePlatform ?? platform;
  const nodeName = String(parsed.nodeName ?? parsed.deviceName ?? defaultNodeName(nodePlatform, hostname, process.env))
    .trim().replace(/\s+/g, " ").slice(0, 48);
  return {
    ...parsed,
    schemaVersion: 2,
    nodeId: parsed.nodeId ?? (nodePlatform === "win32" ? "windows-host" : `relay-${randomUUID()}`),
    nodeName,
    nodePlatform,
    nodeType: parsed.nodeType ?? relayTypeForPlatform(nodePlatform),
    deviceName: nodeName
  };
}

export async function loadConfig(rootDir = process.cwd(), options = {}) {
  const stateDir = path.join(rootDir, ".clipbridge");
  const configPath = path.join(stateDir, "config.json");
  const platform = options.platform ?? process.platform;
  const hostname = options.hostname ?? os.hostname();

  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8"));
    const config = { ...fileDefaults(), ...migrateConfig(parsed, { platform, hostname }) };
    validateConfig(config);
    if (JSON.stringify(parsed) !== JSON.stringify({ ...parsed, schemaVersion: config.schemaVersion, nodeId: config.nodeId, nodeName: config.nodeName, nodePlatform: config.nodePlatform, nodeType: config.nodeType, deviceName: config.deviceName })) {
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    }
    return { ...config, stateDir, configPath };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const config = {
    schemaVersion: 2,
    port: DEFAULT_PORT,
    token: randomBytes(24).toString("base64url"),
    maxTextBytes: DEFAULT_MAX_TEXT_BYTES,
    ...fileDefaults(),
    nodeId: `relay-${randomUUID()}`,
    nodeName: defaultNodeName(platform, hostname, process.env),
    nodePlatform: platform,
    nodeType: relayTypeForPlatform(platform)
  };
  config.deviceName = config.nodeName;

  await mkdir(stateDir, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });

  return { ...config, stateDir, configPath };
}

export function validateConfig(config) {
  if (config.schemaVersion !== 2) {
    throw new Error("Config schemaVersion must be 2.");
  }
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) {
    throw new Error("Config port must be an integer between 1024 and 65535.");
  }
  if (typeof config.token !== "string" || config.token.length < 24) {
    throw new Error("Config token must be a string of at least 24 characters.");
  }
  if (!Number.isInteger(config.maxTextBytes) || config.maxTextBytes < 1024) {
    throw new Error("Config maxTextBytes must be an integer of at least 1024.");
  }
  if (config.maxFileBytes !== undefined && (!Number.isInteger(config.maxFileBytes) || config.maxFileBytes < 1024 * 1024)) {
    throw new Error("Config maxFileBytes must be an integer of at least 1 MiB.");
  }
  if (config.maxFileTotalBytes !== undefined && (!Number.isInteger(config.maxFileTotalBytes) || config.maxFileTotalBytes < (config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES))) {
    throw new Error("Config maxFileTotalBytes must be at least maxFileBytes.");
  }
  if (config.fileTtlMs !== undefined && (!Number.isInteger(config.fileTtlMs) || config.fileTtlMs < 60_000)) {
    throw new Error("Config fileTtlMs must be at least one minute.");
  }
  if (typeof config.deviceName !== "string" || config.deviceName.trim() === "") {
    throw new Error("Config deviceName must be a non-empty string.");
  }
  if (typeof config.nodeId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/.test(config.nodeId)) {
    throw new Error("Config nodeId must be a safe identifier between 3 and 128 characters.");
  }
  if (typeof config.nodeName !== "string" || config.nodeName.trim() === "" || config.nodeName.length > 48) {
    throw new Error("Config nodeName must be between 1 and 48 characters.");
  }
  if (typeof config.nodePlatform !== "string" || config.nodePlatform.length > 32) {
    throw new Error("Config nodePlatform must be a short platform identifier.");
  }
  if (!["windows", "mac", "other"].includes(config.nodeType)) {
    throw new Error("Config nodeType must be windows, mac, or other.");
  }
}
