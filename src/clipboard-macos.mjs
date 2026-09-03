import { spawn } from "node:child_process";

function runCommand(command, input = null, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, [], { stdio: ["pipe", "pipe", "pipe"] });
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
  return {
    readText: () => runCommand("/usr/bin/pbpaste", null, spawnProcess),
    writeText: async (text) => {
      await runCommand("/usr/bin/pbcopy", String(text), spawnProcess);
    }
  };
}

const clipboard = createMacClipboard();
export const readClipboardText = clipboard.readText;
export const writeClipboardText = clipboard.writeText;
