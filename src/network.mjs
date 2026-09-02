import os from "node:os";

export function localIPv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

export function normalizeAddress(address = "") {
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function isPrivateAddress(address) {
  const normalized = normalizeAddress(address).toLowerCase();
  if (normalized === "127.0.0.1" || normalized === "::1") return true;
  if (normalized.startsWith("10.") || normalized.startsWith("192.168.")) return true;
  if (normalized.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return false;
}
