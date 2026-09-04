import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { applyHandoff, createHandoff, findSensitivePatch, handoffEnvironment, inspectHandoff, listAgentComputers, listHandoffs, parseAgentHandoffResponse, registerAgentComputer } from "../src/handoff.mjs";

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
  assert.equal((await readFile(join(target, "work.txt"), "utf8")).replaceAll("\r\n", "\n"), "transferred 苹果 🍎\n");
});

test("detects common credentials in a patch", () => {
  assert.ok(findSensitivePatch("+API_KEY=definitely-secret-value"));
  assert.equal(findSensitivePatch("+const label = 'safe';"), null);
});

test("parses one pasted Agent response into the portable handoff fields", () => {
  const parsed = parseAgentHandoffResponse(`CLIPBRIDGE_HANDOFF_V1
## 当前目标
完成桌面交接 UI
## 已完成、关键决定与当前状态
已经加入环境检测。\n验证中文内容。
## 下一步
运行测试并发布
END_CLIPBRIDGE_HANDOFF`);
  assert.equal(parsed.goal, "完成桌面交接 UI");
  assert.match(parsed.summary, /环境检测/);
  assert.equal(parsed.next, "运行测试并发布");
});

test("reports Node, Git, repository, and GitHub remote readiness", async () => {
  const root = await repository();
  await git(root, ["remote", "add", "origin", "git@github.com:example/project.git"]);
  const status = await handoffEnvironment(root);
  assert.equal(status.node.ok, true);
  assert.equal(status.git.ok, true);
  assert.equal(status.repository.ok, true);
  assert.equal(status.github.ok, true);
});

test("registers Agent computers without modifying the active project branch", async () => {
  const root = await repository();
  await registerAgentComputer({ cwd: root, id: "mac-studio", name: "Mac Studio", type: "mac", platform: "darwin", push: false });
  await registerAgentComputer({ cwd: root, id: "windows-work", name: "Windows 工作站", type: "windows", platform: "win32", push: false });
  const computers = await listAgentComputers({ cwd: root });
  assert.deepEqual(computers.map(({ id }) => id), ["mac-studio", "windows-work"]);
  assert.equal((await git(root, ["branch", "--show-current"])).stdout.trim(), "main");
  assert.equal((await git(root, ["status", "--porcelain"])).stdout, "");
});

test("filters targeted handoffs for the receiving Agent computer", async () => {
  const root = await repository();
  await writeFile(join(root, "work.txt"), "targeted change\n", "utf8");
  await createHandoff({ cwd: root, id: "targeted-test", targetIds: ["windows-work"] });
  assert.equal((await listHandoffs({ cwd: root, recipientId: "windows-work" })).length, 1);
  assert.equal((await listHandoffs({ cwd: root, recipientId: "mac-studio" })).length, 0);
  assert.deepEqual((await inspectHandoff("targeted-test", { cwd: root })).state.delivery.targetIds, ["windows-work"]);
});
