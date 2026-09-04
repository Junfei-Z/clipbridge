import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { applyHandoff, createHandoff, findSensitivePatch, inspectHandoff, listHandoffs } from "../src/handoff.mjs";

const exec = promisify(execFile);
const git = (cwd, args) => exec("git", args, { cwd, encoding: "utf8" });

async function repository() {
  const root = await mkdtemp(join(tmpdir(), "clipbridge-handoff-test-"));
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.name", "Test"]);
  await git(root, ["config", "user.email", "test@example.invalid"]);
  await writeFile(join(root, "work.txt"), "before\n", "utf8");
  await git(root, ["add", "work.txt"]);
  await git(root, ["commit", "-m", "base"]);
  return root;
}

test("creates an inspectable portable handoff without committing the working tree", async () => {
  const root = await repository();
  await writeFile(join(root, "work.txt"), "after 中文 ✅\n", "utf8");
  await writeFile(join(root, "untracked.txt"), "not exported\n", "utf8");
  const result = await createHandoff({ cwd: root, id: "portable-test", goal: "Continue Unicode work", summary: "Changed the tracked fixture", next: "Run tests" });
  assert.equal(result.changes.untrackedOmitted, 1);
  assert.equal(result.pushed, false);
  assert.equal((await git(root, ["branch", "--show-current"])).stdout.trim(), "main");
  assert.equal((await git(root, ["status", "--porcelain"])).stdout.includes("work.txt"), true);
  const inspected = await inspectHandoff("portable-test", { cwd: root });
  assert.match(inspected.markdown, /Continue Unicode work/);
  assert.match(inspected.markdown, /Untracked files omitted: 1/);
  assert.equal(inspected.state.changes.trackedPaths.includes("work.txt"), true);
  assert.equal((await listHandoffs({ cwd: root })).some((item) => item.ref.endsWith("portable-test")), true);
});

test("verifies and applies a handoff patch to a clean clone", async () => {
  const source = await repository();
  await writeFile(join(source, "work.txt"), "transferred 苹果 🍎\n", "utf8");
  await createHandoff({ cwd: source, id: "apply-test" });
  const target = await mkdtemp(join(tmpdir(), "clipbridge-handoff-target-"));
  await git(target, ["clone", "--no-local", source, "."]);
  await git(target, ["fetch", source, "refs/heads/clipbridge/handoff/apply-test:refs/remotes/origin/clipbridge/handoff/apply-test"]);
  const result = await applyHandoff("apply-test", { cwd: target });
  assert.equal(result.applied, true);
  assert.equal(await readFile(join(target, "work.txt"), "utf8"), "transferred 苹果 🍎\n");
});

test("detects common credentials in a patch", () => {
  assert.ok(findSensitivePatch("+API_KEY=definitely-secret-value"));
  assert.equal(findSensitivePatch("+const label = 'safe';"), null);
});
