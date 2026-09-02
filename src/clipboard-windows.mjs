import { spawn } from "node:child_process";

function runPowerShell(script, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
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

export function encodeClipboardPayload(text) {
  return Buffer.from(text, "utf8").toString("base64");
}

export function decodeClipboardPayload(payload) {
  return Buffer.from(payload, "base64").toString("utf8");
}

export async function readClipboardText() {
  const payload = await runPowerShell(`
    Add-Type -AssemblyName System.Windows.Forms
    $value = [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::UnicodeText)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($value)
    [Console]::Out.Write([Convert]::ToBase64String($bytes))
  `);
  return decodeClipboardPayload(payload.trim());
}

export async function writeClipboardText(text) {
  const payload = encodeClipboardPayload(text);
  await runPowerShell(`
    $payload = [Console]::In.ReadToEnd()
    $bytes = [Convert]::FromBase64String($payload)
    $value = [System.Text.Encoding]::UTF8.GetString($bytes)
    Add-Type -AssemblyName System.Windows.Forms
    if ($value.Length -eq 0) {
      [System.Windows.Forms.Clipboard]::Clear()
    }
    else {
      [System.Windows.Forms.Clipboard]::SetText($value, [System.Windows.Forms.TextDataFormat]::UnicodeText)
    }
  `, payload);
}
