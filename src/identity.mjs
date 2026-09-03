const RELAY_TYPES = new Map([
  ["win32", "windows"],
  ["darwin", "mac"]
]);

export function relayTypeForPlatform(platform) {
  return RELAY_TYPES.get(platform) ?? "other";
}

export function relayNodeIdentity(config) {
  const platform = config.nodePlatform ?? "win32";
  return {
    id: config.nodeId ?? "windows-host",
    name: config.nodeName ?? config.deviceName,
    type: config.nodeType ?? relayTypeForPlatform(platform),
    platform,
    role: "relay-node",
    kind: "relay",
    capabilities: ["clipboard", "files", "pairing"]
  };
}

export function isRelayTargetId(targetId, config) {
  const relay = relayNodeIdentity(config);
  return targetId === relay.id || targetId === "windows-host";
}

export function managementSession(identity, { isLocal, legacy = false } = {}) {
  return {
    role: "management-device",
    access: isLocal ? "owner" : legacy ? "legacy" : "paired",
    canManagePairing: Boolean(isLocal),
    canUseRelay: true,
    deviceId: identity.id
  };
}

export function relayPlatformLabel(relay) {
  if (relay.type === "mac") return "Mac";
  if (relay.type === "windows") return "Windows";
  return "设备";
}
