import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

export async function loadConfig(rootDir = process.cwd()) {
  const stateDir = path.join(rootDir, ".clipbridge");
  const configPath = path.join(stateDir, "config.json");

  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8"));
    validateConfig(parsed);
    return { ...fileDefaults(), ...parsed, stateDir, configPath };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const config = {
    port: DEFAULT_PORT,
    token: randomBytes(24).toString("base64url"),
    maxTextBytes: DEFAULT_MAX_TEXT_BYTES,
    ...fileDefaults(),
    deviceName: process.env.COMPUTERNAME || "Windows PC"
  };

  await mkdir(stateDir, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });

  return { ...config, stateDir, configPath };
}

export function validateConfig(config) {
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
}
