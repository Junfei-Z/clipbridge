# ClipBridge

ClipBridge is a lightweight, local-first clipboard bridge for Windows and iPhone. Version 0.1 is deliberately small: it synchronizes plain text over a trusted local network and exposes endpoints that work with Apple Shortcuts.

## What works in 0.1

- Read the current Windows text clipboard from an iPhone Shortcut.
- Send text from an iPhone Shortcut directly into the Windows clipboard.
- Preserve Unicode text, including Chinese, Emoji, accented characters, and line breaks.
- Use the same friendly ClipBridge mascot in the Windows tray, browser tab, and iPhone Home Screen.
- Show a Windows clipboard manager locally and a direction-aware Send/Receive interface on remote devices.
- Pair with a randomly generated 192-bit token.
- Reject connections that do not come from a private or loopback address.
- Keep clipboard contents out of logs and persistent storage.
- Run with Node.js only; there are no third-party packages.
- Open a responsive quick panel from an iPhone or another computer on the same private network.

## Important security boundary

This prototype uses authenticated HTTP but does **not** encrypt traffic. Run it only on a trusted private network. Do not expose port `39393` to the internet or use it on public Wi-Fi. End-to-end encryption and QR-based device identity are planned before a public release.

## Requirements

- Windows 10 or later
- Node.js 20 or later
- iPhone and Windows PC connected to the same trusted Wi-Fi network

## Start the Windows bridge

For the tray experience, double-click (running as administrator is not required):

```text
Start-ClipBridge-Tray.cmd
```

The temporary command window closes immediately. When the service is ready, ClipBridge opens the quick panel in your default browser and stays available from the Windows notification area. Double-clicking the launcher again opens the existing panel rather than starting a duplicate service.

If Windows or the tray process closes unexpectedly, the launcher can clean up the exact ClipBridge service it previously started. It validates a private process record before stopping anything; unrelated Node.js programs and manually started development servers are left alone.

The tray menu can open the quick panel, copy the private pairing URL, or stop ClipBridge. For development and diagnostics, run the service directly:

```powershell
npm start
```

On first launch, ClipBridge creates `.clipbridge/config.json` containing a random pairing token. Direct diagnostic mode prints the PC's local URLs and token; tray-mode logs deliberately omit both.

It also prints a **Quick panel** URL. Open that URL on the iPhone to send or retrieve text immediately without building the Shortcuts first. Safari may require manual long-press copying because clipboard APIs are restricted on non-HTTPS local pages.

### Add ClipBridge to the iPhone Home Screen

Open the paired **Quick panel** URL in Safari, tap **Share**, then choose **Add to Home Screen**. The saved app opens in its own window and uses the same ClipBridge mascot as the Windows tray. Keep the full paired URL when adding it so the Home Screen app can reconnect without asking for the token again.

The interface adapts to the device opening it. Windows localhost shows the current Windows clipboard with **Reload** and **Save to clipboard** actions. iPhone, MacBook, and other devices on the private network get separate **Send** and **Receive** modes; received text can then be copied explicitly to that device.

Remote panels also show the two ends of the current connection, such as **iPhone ↔ PC-20221004LAXX** or **Mac ↔ PC-20221004LAXX**. In 0.1 this is a friendly connection description inferred from the browser family, not yet a persistent or cryptographically verified device identity.

Windows Firewall may ask whether Node.js can accept connections. Allow access only on private networks.

### If startup fails

ClipBridge displays an error dialog instead of leaving an empty command window open. Diagnostic details are written to `.clipbridge/server-error.log`. You can also run `npm start` in PowerShell to see the service output directly.

## Create the iPhone Shortcuts

See [docs/iphone-shortcuts.md](docs/iphone-shortcuts.md). The first prototype uses two Shortcuts:

- **Send to PC**: reads the iPhone clipboard and sends it to Windows.
- **Get from PC**: gets the Windows clipboard and copies it on iPhone.

## API

All clipboard requests require:

```text
Authorization: Bearer <pairing-token>
```

### Read the Windows clipboard

```http
GET /api/v1/clip
```

### Write the Windows clipboard

```http
POST /api/v1/clip
Content-Type: application/json

{"kind":"text","text":"Hello from iPhone"}
```

### Health check

```http
GET /health
```

## Roadmap

1. QR pairing and automatic device discovery.
2. Native Windows tray UI.
3. Images and screenshots.
4. Native macOS menu bar client.
5. iOS Share Extension and App Intents.
6. End-to-end encrypted relay for devices on different networks.

## Development

```powershell
npm test
```

ClipBridge is available under the MIT License.
