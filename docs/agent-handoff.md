# ClipBridge Agent Handoff Beta

> **Computer-only:** Agent Handoff requires Git and Node.js on macOS, Windows, or Linux. Phones and tablets can still use ClipBridge text and file transfer, but cannot create or apply repository handoffs.

## Desktop UI workflow

1. Select the local Git project directory. ClipBridge checks Node.js, Git, repository validity, and the GitHub origin automatically.
2. Copy the official prompt shown in the Agent tab and send it to the Agent currently working on the project.
3. Paste the Agent's complete structured response into the single response field.
4. Choose **Create and push handoff**. ClipBridge extracts the goal, current state, and next actions and packages them with the tracked Git patch.

Free-form replies are accepted as a fallback, but the official prompt produces a more reliable cross-device handoff.

## Connection and multiple computers

Agent Handoff does not maintain a direct online connection to one named computer. Its connection target is the selected GitHub repository. The desktop UI shows that repository as online when the local project is valid and its `origin` points to GitHub.

A handoff is published once as a repository branch. Each desktop can register itself as an Agent computer in that repository. After refreshing the Agent computer list, the sender may select one computer, several computers, or leave the selection empty to publish to all registered Agent computers. A targeted handoff is filtered out on computers that were not selected.

Registration and delivery metadata use dedicated `clipbridge/agent/*` and `clipbridge/handoff/*` branches. They do not switch or modify the active project branch, index, or working tree.

## GitHub account and first-time clone

ClipBridge reads the local GitHub CLI (`gh`) login state. It never sends the CLI token to the management page. When authenticated, the Agent page lists repositories available to that account.

On a computer that does not yet have the project:

1. Open **This computer does not have the project? Clone from GitHub**.
2. Select a repository from the signed-in account, or paste its GitHub URL.
3. Clone it into the default `ClipBridge Projects` directory.
4. ClipBridge fills the new local path, checks the environment, and registers the computer automatically.

If GitHub CLI is not authenticated, run the displayed `gh auth login --web --git-protocol https` command in a terminal, then refresh the account status. A future GitHub OAuth App can move this device authorization fully into the ClipBridge window.

Agent Handoff moves a repository task between computers without copying a vendor-specific chat session. Git carries committed project history; ClipBridge adds a small, reviewable package for the unfinished work and the context the next agent needs.

## What is transferred

Each handoff branch contains one directory:

```text
.clipbridge/handoffs/<handoff-id>/
├── HANDOFF.md
├── state.json
└── changes.patch
```

- `HANDOFF.md` explains the goal, current state, next actions, base commit, and safety notes.
- `state.json` is the portable `dev.clipbridge.handoff/v1` machine-readable record.
- `changes.patch` is a binary-capable Git patch for tracked staged and unstaged changes.

The package does not include the raw agent conversation, tool logs, environment variables, clipboard contents, or untracked files. Common credential patterns in a tracked patch stop creation. `--allow-sensitive` exists only for an explicitly reviewed exceptional case and should normally never be used.

## Send work from the current computer

Run this inside a Git clone whose `origin` is accessible from both computers:

```bash
npm run handoff -- create \
  --goal "Finish the Mac acceptance test" \
  --summary "The launcher builds; clipboard tests pass" \
  --next "Run the signed app on the second Mac" \
  --push
```

An agent can provide longer context through UTF-8 files:

```bash
npm run handoff -- create \
  --goal-file /path/to/goal.md \
  --summary-file /path/to/summary.md \
  --next-file /path/to/next.md \
  --push
```

Creation does not switch branches, stage the working tree, or commit unfinished changes to the current branch. It constructs a separate `clipbridge/handoff/<id>` commit and pushes only when `--push` is present. Existing local commits are included naturally as the handoff branch's ancestry.

## Receive work on another computer

Clone or open the same repository, then fetch and list handoffs:

```bash
npm install
npm run handoff -- list --fetch
```

Read the package before applying it:

```bash
npm run handoff -- inspect <handoff-id>
```

Apply the verified patch to a clean working tree:

```bash
npm run handoff -- apply <handoff-id>
npm test
```

`apply` refuses to run when the receiving working tree is dirty. It verifies the patch SHA-256 recorded in `state.json`, then uses Git's three-way apply mode. A conflict remains visible in the working tree for the user or receiving agent to resolve; ClipBridge never silently overwrites it.

## Relationship to chat sessions

Provider chat/session data is intentionally outside the portable format. A sending agent should summarize only durable decisions, evidence, constraints, and next actions in `HANDOFF.md`. The receiving agent can start a new session, read that document and `state.json`, inspect the Git history and patch, and continue without depending on one agent product's private session format.
