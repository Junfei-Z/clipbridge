import assert from "node:assert/strict";
import test from "node:test";
import { PairingManager } from "../src/pairing.mjs";

test("pairing sessions expire and are single-use", () => {
  let time = Date.parse("2026-09-01T12:00:00Z");
  const manager = new PairingManager({ now: () => time, lifetimeMs: 1000 });
  const first = manager.create();
  assert.match(first.code, /^\d{6}$/);
  assert.equal(manager.consume(first.code).id, first.id);
  assert.throws(() => manager.consume(first.code), /无效或已过期/);

  const second = manager.create();
  time += 1001;
  assert.throws(() => manager.consume(second.code), /无效或已过期/);
});

test("pairing attempts are rate-limited per requester", () => {
  const manager = new PairingManager();
  manager.create();
  for (let index = 0; index < 8; index += 1) {
    assert.throws(() => manager.consume("000000", "phone-a"), /无效或已过期/);
  }
  assert.throws(() => manager.consume("000000", "phone-a"), (error) => error.status === 429);
  assert.throws(() => manager.consume("000000", "phone-b"), (error) => error.status === 401);
});
