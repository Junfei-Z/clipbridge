import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { hostname, platform, tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REF_PREFIX = "clipbridge/handoff/";
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET|PASSWORD)\s*[:=]\s*["']?[^\s"']{8,}/i,
];

async function git(cwd, args, options = {}) {
  try {
    const result = await execFileAsync("git", args, {
      cwd,
      encoding: options.encoding ?? "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...options.env },
      input: options.input,
    });
    return result.stdout;
  } catch (error) {
    const detail = String(error.stderr || error.message).trim();
    throw new Error(`git ${args[0]} failed${detail ? `: ${detail}` : ""}`);
  }
}

function cleanText(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function markdown(value) {
  return String(value).replaceAll("\r", "").trim();
}

function redactRemote(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return value.replace(/\/\/[^/@]+@/, "//");
  }
}

function changedPaths(status) {
  return status.split("\0").filter(Boolean).map((entry) => entry.slice(3)).filter((path) => !path.startsWith(".clipbridge/"));
}

export function findSensitivePatch(patch) {
  return SECRET_PATTERNS.find((pattern) => pattern.test(patch))?.source || null;
}

export function parseAgentHandoffResponse(value) {
  const text = markdown(value);
  if (!text) throw new Error("请先粘贴 Agent 生成的交接说明。");
  const sections = new Map();
  let current = "summary";
  sections.set(current, []);
  for (const line of text.split("\n")) {
    const heading = line.match(/^#{1,3}\s*(.+?)\s*$/)?.[1]?.toLowerCase();
    if (heading) {
      if (/goal|目标/.test(heading)) current = "goal";
      else if (/next|下一步|后续/.test(heading)) current = "next";
      else current = "summary";
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (!/^\s*(?:clipbridge_handoff_v1|end_clipbridge_handoff)\s*$/i.test(line)) sections.get(current).push(line);
  }
  return {
    goal: cleanText(sections.get("goal")?.join("\n"), "Continue the current repository task"),
    summary: cleanText(sections.get("summary")?.join("\n"), text),
    next: cleanText(sections.get("next")?.join("\n"), "Inspect the package, apply the patch, verify, and continue."),
  };
}

export async function handoffEnvironment(cwd = process.cwd()) {
  const result = {
    node: { ok: true, detail: process.version },
    git: { ok: false, detail: "未找到 Git" },
    repository: { ok: false, detail: "请选择 Git 项目目录" },
    github: { ok: false, detail: "未配置 GitHub origin" },
  };
  try { result.git = { ok: true, detail: (await execFileAsync("git", ["--version"], { encoding: "utf8" })).stdout.trim() }; }
  catch { return result; }
  try {
    const repo = await repositoryInfo(cwd);
    result.repository = { ok: true, detail: repo.root };
    result.github = repo.remote && /(?:github\.com[:/]|github\.com$)/i.test(repo.remote)
      ? { ok: true, detail: repo.remote }
      : { ok: false, detail: repo.remote ? "origin 不是 GitHub 仓库" : "未配置 origin" };
  } catch (error) {
    result.repository.detail = error.message;
  }
  return result;
}

export async function repositoryInfo(cwd) {
  const root = (await git(cwd, ["rev-parse", "--show-toplevel"])).trim();
  const baseCommit = (await git(root, ["rev-parse", "HEAD"])).trim();
  const currentBranch = (await git(root, ["branch", "--show-current"])).trim() || null;
  let remote = null;
  try { remote = redactRemote((await git(root, ["remote", "get-url", "origin"])).trim()); } catch {}
  return { root, baseCommit, currentBranch, remote };
}

export async function createHandoff(options = {}) {
  const repo = await repositoryInfo(options.cwd || process.cwd());
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const device = hostname().replace(/[^A-Za-z0-9-]/g, "-").slice(0, 32) || platform();
  const id = options.id || `${stamp}-${device}-${randomUUID().slice(0, 8)}`;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error("Handoff id may only contain letters, numbers, dots, underscores, and hyphens");

  const status = await git(repo.root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const paths = changedPaths(status);
  const tracked = paths.filter((path) => !status.split("\0").some((entry) => entry.startsWith("?? ") && entry.slice(3) === path));
  const untracked = paths.filter((path) => status.split("\0").some((entry) => entry.startsWith("?? ") && entry.slice(3) === path));
  const patch = await git(repo.root, ["diff", "HEAD", "--binary", "--", ".", ":(exclude).clipbridge"]);
  const secret = findSensitivePatch(patch);
  if (secret && !options.allowSensitive) throw new Error("The tracked diff looks like it contains a secret. Remove it or repeat with --allow-sensitive after reviewing the patch.");

  const branch = `${REF_PREFIX}${id}`;
  try {
    await git(repo.root, ["rev-parse", "--verify", `refs/heads/${branch}`]);
    throw new Error(`Handoff already exists: ${id}`);
  } catch (error) {
    if (error.message === `Handoff already exists: ${id}`) throw error;
  }
  const packageDir = join(repo.root, ".clipbridge", "handoffs", id);
  const patchName = "changes.patch";
  const checksum = createHash("sha256").update(patch).digest("hex");
  const state = {
    schema: "dev.clipbridge.handoff/v1",
    id,
    createdAt,
    repository: { name: basename(repo.root), remote: repo.remote, baseCommit: repo.baseCommit, sourceBranch: repo.currentBranch },
    source: { hostname: hostname(), platform: platform() },
    handoffBranch: branch,
    goal: cleanText(options.goal, "Continue the current repository task"),
    summary: cleanText(options.summary, "See the patch and repository history."),
    next: cleanText(options.next, "Inspect the package, apply the patch, verify, and continue."),
    changes: { trackedPaths: tracked.sort(), untrackedOmitted: untracked.length, patch: patchName, sha256: checksum, bytes: Buffer.byteLength(patch) },
  };
  const handoff = `# ClipBridge Agent Handoff\n\n## Goal\n\n${markdown(state.goal)}\n\n## Current state\n\n${markdown(state.summary)}\n\n## Next actions\n\n${markdown(state.next)}\n\n## Repository state\n\n- Base commit: \`${state.repository.baseCommit}\`\n- Source branch: \`${state.repository.sourceBranch || "detached HEAD"}\`\n- Tracked paths in patch: ${tracked.length}\n- Untracked files omitted: ${untracked.length}\n- Patch SHA-256: \`${checksum}\`\n\nThe receiving agent should read this file and \`state.json\`, verify the patch checksum, and inspect the patch before applying it.\n`;
  await mkdir(packageDir, { recursive: true });
  await Promise.all([
    writeFile(join(packageDir, "HANDOFF.md"), handoff, "utf8"),
    writeFile(join(packageDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8"),
    writeFile(join(packageDir, patchName), patch, "utf8"),
  ]);

  const temp = await mkdtemp(join(tmpdir(), "clipbridge-handoff-"));
  try {
    const index = join(temp, "index");
    const env = { GIT_INDEX_FILE: index };
    await git(repo.root, ["read-tree", repo.baseCommit], { env });
    await git(repo.root, ["add", "-f", "--", relative(repo.root, packageDir)], { env });
    const tree = (await git(repo.root, ["write-tree"], { env })).trim();
    const identity = {
      GIT_AUTHOR_NAME: "ClipBridge Handoff",
      GIT_AUTHOR_EMAIL: "handoff@clipbridge.local",
      GIT_COMMITTER_NAME: "ClipBridge Handoff",
      GIT_COMMITTER_EMAIL: "handoff@clipbridge.local",
    };
    const commit = (await git(repo.root, ["commit-tree", tree, "-p", repo.baseCommit, "-m", `Agent handoff ${id}`], { env: identity })).trim();
    await git(repo.root, ["update-ref", `refs/heads/${branch}`, commit]);
    if (options.push) await git(repo.root, ["push", "origin", `refs/heads/${branch}:refs/heads/${branch}`]);
    return { ...state, packageDir, commit, pushed: Boolean(options.push) };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function listHandoffs(options = {}) {
  const repo = await repositoryInfo(options.cwd || process.cwd());
  if (options.fetch) await git(repo.root, ["fetch", "origin", `+refs/heads/${REF_PREFIX}*:refs/remotes/origin/${REF_PREFIX}*`]);
  const output = await git(repo.root, ["for-each-ref", "--format=%(refname:short)%09%(committerdate:iso8601)", `refs/heads/${REF_PREFIX}`, `refs/remotes/origin/${REF_PREFIX}`]);
  const found = output.trim().split("\n").filter(Boolean).map((line) => {
    const [ref, date] = line.split("\t");
    const id = ref.slice(ref.indexOf(REF_PREFIX) + REF_PREFIX.length);
    return { id, ref, date };
  });
  return [...new Map(found.map((item) => [item.id, item])).values()];
}

async function resolveHandoff(repo, id) {
  const candidates = [`refs/heads/${REF_PREFIX}${id}`, `refs/remotes/origin/${REF_PREFIX}${id}`, id];
  for (const ref of candidates) {
    try { await git(repo.root, ["rev-parse", "--verify", ref]); return ref; } catch {}
  }
  throw new Error(`Handoff not found: ${id}`);
}

export async function inspectHandoff(id, options = {}) {
  const repo = await repositoryInfo(options.cwd || process.cwd());
  const ref = await resolveHandoff(repo, id);
  const prefix = `.clipbridge/handoffs/${id}`;
  const markdownText = await git(repo.root, ["show", `${ref}:${prefix}/HANDOFF.md`]);
  const state = JSON.parse(await git(repo.root, ["show", `${ref}:${prefix}/state.json`]));
  return { ref, markdown: markdownText, state };
}

export async function applyHandoff(id, options = {}) {
  const repo = await repositoryInfo(options.cwd || process.cwd());
  if ((await git(repo.root, ["status", "--porcelain"])).trim()) throw new Error("Working tree must be clean before applying a handoff");
  const ref = await resolveHandoff(repo, id);
  const prefix = `.clipbridge/handoffs/${id}`;
  const state = JSON.parse(await git(repo.root, ["show", `${ref}:${prefix}/state.json`]));
  const patch = await git(repo.root, ["show", `${ref}:${prefix}/${state.changes.patch}`]);
  const checksum = createHash("sha256").update(patch).digest("hex");
  if (checksum !== state.changes.sha256) throw new Error("Handoff patch checksum does not match state.json");
  if (patch.length) {
    const temp = await mkdtemp(join(tmpdir(), "clipbridge-apply-"));
    try {
      const patchFile = join(temp, "changes.patch");
      await writeFile(patchFile, patch, "utf8");
      await git(repo.root, ["apply", "--3way", "--binary", patchFile]);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
  return { ref, state, applied: Boolean(patch.length) };
}
