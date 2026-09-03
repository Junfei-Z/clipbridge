import assert from "node:assert/strict";
import test from "node:test";
import { isRelayTargetId, managementSession, relayNodeIdentity } from "../src/identity.mjs";

test("describes relay nodes separately from management sessions", () => {
  const relay = relayNodeIdentity({
    nodeId: "relay-macbook",
    nodeName: "Junfei MacBook",
    nodePlatform: "darwin",
    nodeType: "mac"
  });

  assert.equal(relay.role, "relay-node");
  assert.equal(relay.kind, "relay");
  assert.deepEqual(relay.capabilities, ["clipboard", "files", "pairing"]);
  assert.deepEqual(managementSession({ id: "iphone-1" }, { isLocal: false }), {
    role: "management-device",
    access: "paired",
    canManagePairing: false,
    canUseRelay: true,
    deviceId: "iphone-1"
  });
});

test("keeps windows-host as a migration alias for the current relay", () => {
  const config = { nodeId: "relay-macbook", nodeName: "Mac", nodePlatform: "darwin", nodeType: "mac" };
  assert.equal(isRelayTargetId("relay-macbook", config), true);
  assert.equal(isRelayTargetId("windows-host", config), true);
  assert.equal(isRelayTargetId("another-device", config), false);
});
