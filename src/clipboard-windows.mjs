import { spawn } from "node:child_process";

function runPowerShell(script, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
    );

    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || `PowerShell exited with ${code}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });

    child.stdin.end(input, "utf8");
  });
}

export async function readClipboardText() {
  const value = await runPowerShell("Get-Clipboard -Raw -TextFormatType Text");
  return value.replace(/\r?\n$/, "");
}

export async function writeClipboardText(text) {
  await runPowerShell("Set-Clipboard -Value ([Console]::In.ReadToEnd())", text);
}
