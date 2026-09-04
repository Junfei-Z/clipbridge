import { spawn } from "node:child_process";

function runCommand(command, args = [], input = null, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        LANG: "en_US.UTF-8",
        LC_CTYPE: "UTF-8"
      }
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || `${command} exited with ${code}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });

    child.stdin.end(input ?? undefined, input === null ? undefined : "utf8");
  });
}

export function createMacClipboard({ spawnProcess = spawn } = {}) {
  const helper = process.env.CLIPBRIDGE_CLIPBOARD_HELPER;
  return {
    readText: () => helper
      ? runCommand(helper, ["read"], null, spawnProcess)
      : runCommand("/usr/bin/pbpaste", [], null, spawnProcess),
    writeText: async (text) => {
      if (helper) await runCommand(helper, ["write"], String(text), spawnProcess);
      else await runCommand("/usr/bin/pbcopy", [], String(text), spawnProcess);
    }
  };
}

const clipboard = createMacClipboard();
export const readClipboardText = clipboard.readText;
export const writeClipboardText = clipboard.writeText;
