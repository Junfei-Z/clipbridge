import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, hostname, platform, tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REF_PREFIX = "clipbridge/handoff/";
const AGENT_REF_PREFIX = "clipbridge/agent/";
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

function safeDeviceId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(id)) throw new Error("Agent computer id is invalid");
  return id;
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

export function defaultProjectsDirectory() {
  return join(homedir(), "ClipBridge Projects");
}

function githubRepositorySlug(value) {
  const source = String(value || "").trim();
  const match = source.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i);
  if (!match) throw new Error("请输入完整的 GitHub 仓库地址，例如 https://github.com/owner/project.git");
  return { owner: match[1], repository: match[2], source };
}

export async function cloneGitHubRepository(options = {}) {
  const repo = githubRepositorySlug(options.repositoryUrl);
  const projectsDirectory = resolve(options.projectsDirectory || defaultProjectsDirectory());
  const destination = join(projectsDirectory, repo.repository);
  await mkdir(projectsDirectory, { recursive: true });
  try {
    await access(destination);
    throw new Error(`目标目录已经存在：${destination}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await git(projectsDirectory, ["clone", "--origin", "origin", repo.source, destination]);
    return { root: destination, repository: `${repo.owner}/${repo.repository}`, remote: repo.source };
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    if (/authentication|permission denied|repository not found|could not read username/i.test(error.message)) {
      throw new Error("无法访问这个 GitHub 仓库。请先在这台电脑配置 GitHub 凭据，并确认当前账户拥有仓库权限。");
    }
    throw error;
  }
}

export async function githubAccountStatus() {
  const result = { cli: false, authenticated: false, account: null, repositories: [], loginCommand: "gh auth login --web --git-protocol https" };
  try {
    result.version = (await execFileAsync("gh", ["--version"], { encoding: "utf8" })).stdout.split("\n")[0];
    result.cli = true;
  } catch {
    result.detail = "未安装 GitHub CLI（gh）";
    return result;
  }
  try {
    const user = JSON.parse((await execFileAsync("gh", ["api", "user"], { encoding: "utf8", env: { ...process.env, GH_PROMPT_DISABLED: "1" } })).stdout);
    result.authenticated = true;
    result.account = { login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url };
    result.repositories = JSON.parse((await execFileAsync("gh", ["repo", "list", "--limit", "100", "--json", "nameWithOwner,url,isPrivate,updatedAt"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, env: { ...process.env, GH_PROMPT_DISABLED: "1" } })).stdout);
    result.detail = `已登录 ${result.account.login}`;
  } catch {
    result.detail = "GitHub CLI 尚未登录";
  }
  return result;
}

export async function updateGitHubRepository(cwd) {
  const repo = await repositoryInfo(cwd || process.cwd());
  if (!repo.remote || !/(?:github\.com[:/]|github\.com$)/i.test(repo.remote)) throw new Error("这个项目没有配置 GitHub origin。");
  if (!repo.currentBranch) throw new Error("当前项目处于 detached HEAD，请先切换到需要更新的分支。");
  const dirty = (await git(repo.root, ["status", "--porcelain"])).trim();
  if (dirty) throw new Error("项目存在未提交修改，已停止更新以免覆盖本地工作。请先提交、暂存交接或清理修改。");
  await git(repo.root, ["fetch", "--prune", "origin"]);
  const remoteBranch = `origin/${repo.currentBranch}`;
  try { await git(repo.root, ["rev-parse", "--verify", remoteBranch]); }
  catch { throw new Error(`GitHub 上没有 ${repo.currentBranch} 分支，无法自动更新。`); }
  const [ahead, behind] = (await git(repo.root, ["rev-list", "--left-right", "--count", `HEAD...${remoteBranch}`])).trim().split(/\s+/).map(Number);
  if (ahead && behind) throw new Error(`本地与 GitHub 已分叉（本地多 ${ahead} 个提交，远端多 ${behind} 个提交），请人工合并。`);
  if (ahead) return { root: repo.root, branch: repo.currentBranch, status: "ahead", ahead, behind: 0, updated: false };
  if (!behind) return { root: repo.root, branch: repo.currentBranch, status: "current", ahead: 0, behind: 0, updated: false };
  await git(repo.root, ["merge", "--ff-only", remoteBranch]);
  return { root: repo.root, branch: repo.currentBranch, status: "updated", ahead: 0, behind, updated: true };
}

export async function chooseProjectDirectory(targetPlatform = platform()) {
  if (targetPlatform === "darwin") {
    const script = 'POSIX path of (choose folder with prompt "选择 Git 项目目录")';
    return (await execFileAsync("osascript", ["-e", script], { encoding: "utf8" })).stdout.trim().replace(/\/$/, "");
  }
  if (targetPlatform === "win32") {
    const script = "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='选择 Git 项目目录'; if($d.ShowDialog() -eq 'OK'){[Console]::OutputEncoding=[Text.Encoding]::UTF8; Write-Output $d.SelectedPath}";
    return (await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], { encoding: "utf8" })).stdout.trim();
  }
  try { return (await execFileAsync("zenity", ["--file-selection", "--directory", "--title=选择 Git 项目目录"], { encoding: "utf8" })).stdout.trim(); }
  catch { throw new Error("当前系统无法打开目录选择器，请手动输入项目完整路径。"); }
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
    delivery: {
      sender: options.sourceAgent || null,
      targetIds: Array.isArray(options.targetIds) ? [...new Set(options.targetIds.map(safeDeviceId))] : [],
      mode: Array.isArray(options.targetIds) && options.targetIds.length ? "targeted" : "repository",
    },
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

export async function registerAgentComputer(options = {}) {
  const repo = await repositoryInfo(options.cwd || process.cwd());
  const id = safeDeviceId(options.id);
  const registeredAt = new Date().toISOString();
  const profile = {
    schema: "dev.clipbridge.agent-computer/v1",
    id,
    name: cleanText(options.name, hostname()),
    type: cleanText(options.type, platform()),
    platform: cleanText(options.platform, platform()),
    registeredAt,
    repository: { name: basename(repo.root), remote: repo.remote },
  };
  const temp = await mkdtemp(join(tmpdir(), "clipbridge-agent-profile-"));
  try {
    const manifest = join(temp, `${id}.json`);
    await writeFile(manifest, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
    const index = join(temp, "index");
    const env = { GIT_INDEX_FILE: index };
    await git(repo.root, ["read-tree", "--empty"], { env });
    const blob = (await git(repo.root, ["hash-object", "-w", manifest])).trim();
    await git(repo.root, ["update-index", "--add", "--cacheinfo", `100644,${blob},.clipbridge/agents/${id}.json`], { env });
    const tree = (await git(repo.root, ["write-tree"], { env })).trim();
    const identity = {
      GIT_AUTHOR_NAME: "ClipBridge Agent Registry",
      GIT_AUTHOR_EMAIL: "handoff@clipbridge.local",
      GIT_COMMITTER_NAME: "ClipBridge Agent Registry",
      GIT_COMMITTER_EMAIL: "handoff@clipbridge.local",
    };
    const commit = (await git(repo.root, ["commit-tree", tree, "-m", `Register Agent computer ${profile.name}`], { env: identity })).trim();
    const branch = `${AGENT_REF_PREFIX}${id}`;
    await git(repo.root, ["update-ref", `refs/heads/${branch}`, commit]);
    if (options.push !== false) await git(repo.root, ["push", "--force", "origin", `refs/heads/${branch}:refs/heads/${branch}`]);
    return { ...profile, branch, commit, pushed: options.push !== false };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function listAgentComputers(options = {}) {
  const repo = await repositoryInfo(options.cwd || process.cwd());
  if (options.fetch) await git(repo.root, ["fetch", "origin", `+refs/heads/${AGENT_REF_PREFIX}*:refs/remotes/origin/${AGENT_REF_PREFIX}*`]);
  const output = await git(repo.root, ["for-each-ref", "--format=%(refname)", `refs/heads/${AGENT_REF_PREFIX}`, `refs/remotes/origin/${AGENT_REF_PREFIX}`]);
  const profiles = [];
  const seen = new Set();
  for (const fullRef of output.trim().split("\n").filter(Boolean)) {
    const id = fullRef.slice(fullRef.indexOf(AGENT_REF_PREFIX) + AGENT_REF_PREFIX.length);
    if (seen.has(id)) continue;
    try {
      const profile = JSON.parse(await git(repo.root, ["show", `${fullRef}:.clipbridge/agents/${id}.json`]));
      seen.add(id); profiles.push({ ...profile, ref: fullRef });
    } catch {}
  }
  return profiles.sort((left, right) => left.name.localeCompare(right.name));
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
  const unique = [...new Map(found.map((item) => [item.id, item])).values()];
  const visible = [];
  for (const item of unique) {
    try {
      const ref = item.ref.startsWith("origin/") ? `refs/remotes/${item.ref}` : `refs/heads/${item.ref}`;
      const state = JSON.parse(await git(repo.root, ["show", `${ref}:.clipbridge/handoffs/${item.id}/state.json`]));
      if (!options.recipientId || state.delivery?.mode !== "targeted" || state.delivery.targetIds?.includes(options.recipientId)) {
        visible.push({ ...item, goal: state.goal, sender: state.delivery?.sender || state.source, delivery: state.delivery });
      }
    } catch { visible.push(item); }
  }
  return visible;
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
