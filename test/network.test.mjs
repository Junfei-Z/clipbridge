import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateAddress, normalizeAddress } from "../src/network.mjs";

test("normalizes IPv4-mapped IPv6 addresses", () => {
  assert.equal(normalizeAddress("::ffff:192.168.1.20"), "192.168.1.20");
});

test("accepts private and rejects public addresses", () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "172.16.0.4", "192.168.2.2", "::1", "fe80::1"])
    assert.equal(isPrivateAddress(address), true, address);
  for (const address of ["8.8.8.8", "172.15.0.4", "1.1.1.1"])
    assert.equal(isPrivateAddress(address), false, address);
});
