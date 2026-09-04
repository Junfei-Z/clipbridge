<p align="center">
  <img src="assets/icon-512.png" width="128" height="128" alt="ClipBridge mascot">
</p>

<h1 align="center">ClipBridge</h1>

<p align="center"><strong>A lightweight, local-first clipboard bridge for the devices you already use.</strong></p>

ClipBridge transfers text and files between a Windows PC, Mac, iPhone, Android phone, and other devices on the same trusted private network. Version 0.5 lets either Windows or macOS act as the local relay node, while browser interfaces are explicitly modeled as management/endpoint devices. It requires no cloud account and does not upload content to a third-party service.

Version 0.6 also provides an HTTPS PWA at `https://junfei-z.github.io/clipbridge/` for encrypted WebRTC text and file transfer between two online browsers. GitHub Pages serves only the static app; transfer content travels over the peer-to-peer DataChannel.

## Online WebRTC transfer in 0.6

1. Open `https://junfei-z.github.io/clipbridge/` on both devices.
2. On one device choose **创建连接**, then send its one-time invitation code to the other device.
3. On the other device choose **加入连接**, paste the invitation, generate an answer, and send that answer back.
4. Paste the answer on the creating device. When both pages show **已直连**, send text or files in either direction.

The public PWA has no account and no content database. Connection codes contain ephemeral network negotiation metadata, so share them only with the intended device. Some restrictive networks may require a TURN relay; 0.6.0 reports connection failure rather than uploading content to an untrusted fallback. See [the online PWA guide](docs/online-pwa.md).

## What works in 0.5

- Pair an iPhone, iPad, Mac, Android device, or another computer with a one-time 6-digit code or local QR code.
- Give every paired device an independent 256-bit access key.
- Store only SHA-256 key hashes on Windows, never the usable device keys.
- Run a lightweight native menu bar relay on macOS or a notification-area relay on Windows.
- Keep the management-device role separate from the relay node, even when both roles run on one computer.
- View paired device names and last-seen times from the relay node panel.
- Revoke one device without breaking access for the others.
- Send Unicode plain text to a Windows or Mac relay and retrieve the current relay-node clipboard.
- Use a focused clipboard manager on the relay node and direction-aware **Send** / **Receive** modes remotely.
- Reuse, copy, delete, or clear the latest 50 explicit ClipBridge transfers from a device-scoped history.
- Choose a named target such as Windows, iPhone, or Mac instead of always sending in one direction.
- Select several named targets and send the same text or file to all of them in one action.
- Queue up to 50 pending texts per paired device in an isolated Windows-hosted inbox.
- Send photos, videos, PDFs, SVGs, source code, archives, and other files to a named paired device.
- Stream file uploads directly to Windows disk with progress and cancellation instead of buffering a whole video in memory.
- Open safe previews for common images, videos, PDFs, and plain-text code; SVG and HTML are shown as inert text rather than executed.
- Download through short-lived, single-use links that never place the device access key in the URL.
- Automatically remove temporary files after 24 hours, when the target deletes them, or when either paired device is revoked.
- Store one shared Blob for a multi-recipient file and track each recipient as pending or downloaded independently.
- Keep the same high-resolution ClipBridge mascot in the tray, browser, and iPhone Home Screen.
- Continue opening v0.1 shared-token links during migration.

## Security boundary

Pairing and authorization are device-specific in 0.5, but transport is still ordinary HTTP and is **not encrypted**. Run ClipBridge only on a trusted private network. Do not expose port `39393` to the internet, use it on public Wi-Fi, or transfer passwords, verification codes, private keys, or sensitive work material.

Pairing codes expire after five minutes, work once, and rate-limit incorrect guesses. QR codes are generated locally; ClipBridge does not send pairing links or clipboard content to a QR service or other cloud service.

## Requirements

- Windows 10 or later, or macOS 12 or later
- Node.js 20 or later
- The relay node and other devices connected to the same trusted Wi-Fi or private LAN

## Start ClipBridge on Windows

After downloading a source archive, open PowerShell in the extracted folder and install the single QR-code dependency once:

```powershell
npm install
```

ClipBridge can still start and pair by 6-digit code if this optional QR renderer is not installed, but the scannable QR image will be unavailable.

Double-click:

```text
Start-ClipBridge-Tray.cmd
```

Administrator access is not required. The temporary command window closes, the local panel opens in the default browser, and ClipBridge remains available from the Windows notification area. Starting it again opens the existing panel instead of creating a duplicate service.

The tray menu can open the Windows panel, copy the device URL, or stop ClipBridge. For development and diagnostics, run:

```powershell
npm start
```

Windows Firewall may ask whether Node.js can accept connections. Allow it only on private networks.

## Start ClipBridge on macOS

Install dependencies once in Terminal, then double-click `Start-ClipBridge-Mac.command`:

```bash
npm install
./Start-ClipBridge-Mac.command
```

The launcher uses Apple Command Line Tools to build a small native Objective-C/AppKit menu bar app in `dist/ClipBridge.app`. Using clang rather than Swift also keeps the launcher working when a partial Apple tools update leaves the Swift compiler and SDK at different patch builds. Its menu can open the management panel, copy the LAN device URL, or quit the Mac relay. Clipboard access uses the built-in `pbpaste` and `pbcopy` tools, so Unicode text does not pass through a legacy code page.

See [the macOS relay guide](docs/macos-relay.md) for role definitions, requirements, and the hardware-validation boundary.

### Pair an iPhone or another device

1. Open ClipBridge on the Windows or Mac relay node.
2. Under **Paired devices**, choose **Pair new device**.
3. Scan the local QR code with the iPhone camera, or open the copied device URL and enter the 6-digit code.
4. Confirm the device name and type, then choose **Secure pair**.
5. The device keeps its own access key in local browser storage. The key is not placed in the URL.

From the relay node you can later review the device and choose **Revoke**. The revoked device immediately loses clipboard access while every other paired device continues working.

### Send between iPhone, Mac, and Windows

1. Pair each device with the same Windows or Mac ClipBridge relay.
2. Open **Send** and choose one or more named target devices.
3. Sending to the relay node writes immediately to its Windows or Mac clipboard.
4. Sending to another paired device places the text in that device's private inbox on the relay node.
5. The target opens **Receive**, chooses **Copy and accept**, and the item leaves its inbox while remaining available in scoped history.

The relay node must be running and every device must be on the same trusted private network. The target browser does not have to remain open while a text is queued.

### Send a file from Android to iPhone through Windows

1. Pair both the Android phone and iPhone with the same Windows ClipBridge service.
2. On Android, open ClipBridge and switch from **Text** to **Files**.
3. Choose the paired iPhone and any other intended recipients, select one or more files, and choose **Send files**.
4. The relay node stores one inert temporary Blob per file and creates an independent delivery record for every target; it does not open or execute the file.
5. On iPhone, open **Files**, then open, download, or delete the item from that device's private file inbox.

The default limits are 256 MB per file, 1 GB of temporary file storage, and 24-hour retention. They can be changed in `.clipbridge/config.json`. iOS requires an explicit tap to download or save a received file; a local HTTP web app cannot silently write into Photos or Files.

### Add ClipBridge to the iPhone Home Screen

After pairing in Safari, tap **Share**, then **Add to Home Screen**. The saved app opens without a token in its URL and uses the same ClipBridge icon as Windows. Safari may require manual long-press copying because clipboard APIs are restricted on non-HTTPS local pages.

### If startup fails

ClipBridge shows an error dialog instead of leaving an empty command window. Diagnostic details are written to `.clipbridge/server-error.log`. You can also run `npm start` in PowerShell to see the service output directly.

## Stored data

ClipBridge keeps local settings beside the relay in `.clipbridge/`:

- `config.json` contains the port, stable relay-node identity/platform, and the legacy v0.1 migration token.
- `devices.json` contains device metadata and key hashes. Usable per-device keys are never written there.
- `history.json` contains up to 50 text transfers explicitly made through ClipBridge, including source, target, and timestamp.
- `inbox.json` contains up to 50 pending texts per target device until that device accepts, ignores, or clears them.
- `files.json` contains shared Blob metadata and separate per-target delivery states, including source, target, size, checksum, and expiry time.
- `files/` contains opaque temporary file blobs. Original filenames are never used as disk paths.

ClipBridge does not watch or index every relay clipboard change. History stays on the Windows or Mac relay node: its local management panel can see all entries, while a paired device only receives entries in which that device is the source or target. Single entries and the visible history scope can be cleared from either interface.

## Apple Shortcuts migration

The paired web app is the recommended iPhone experience in 0.3. Existing v0.1 Apple Shortcuts continue to work with the legacy token while users migrate, but named targets and inboxes require secure device pairing. See [docs/iphone-shortcuts.md](docs/iphone-shortcuts.md) for the compatibility setup and its security trade-off.

## API

Paired remote requests use the device key returned by `POST /api/v1/pair`:

```text
Authorization: Bearer <device-key>
```

### Pair a device

```http
POST /api/v1/pair
Content-Type: application/json

{"code":"123456","name":"Junfei's iPhone","type":"iphone"}
```

Pairing-session creation, device listing, and revocation are restricted to Windows loopback requests.

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

### Inspect the current identity

```http
GET /api/v1/session
```

The response separates the browser session from the host process: `session.role` is `management-device`, while `relayNode.role` is `relay-node`. Relay metadata can also be read with:

```http
GET /api/v1/node
```

Loopback management sessions have owner access and can create or revoke pairings. Paired remote management devices remain scoped to their own transfers.

### List or clear clipboard history

```http
GET /api/v1/history?limit=50
DELETE /api/v1/history
DELETE /api/v1/history/<entry-id>
```

Windows loopback requests can manage every entry. A paired device is limited to transfers involving its own device identity.

### Discover targets and route text

```http
GET /api/v1/peers
POST /api/v1/transfers
Content-Type: application/json

{"kind":"text","text":"Hello everyone","targetIds":["<relay-node-id>","<iphone-id>","<mac-id>"]}
```

The v0.4 `windows-host` target remains a compatibility alias for whichever relay node is currently active.

### Read or clear the current device inbox

```http
GET /api/v1/inbox
DELETE /api/v1/inbox/<transfer-id>
DELETE /api/v1/inbox
```

Inbox endpoints are target-scoped: one paired device cannot inspect or consume another device's pending transfers.

### Send and receive files

Upload a raw file body with one or more repeated `targetId` values and the display name in the query string. The body is stored once even when several targets are selected:

```http
POST /api/v1/file-transfers?targetId=<iphone-id>&targetId=<mac-id>&name=photo.jpg
Content-Type: image/jpeg

<raw file bytes>
```

The target lists and clears only its own file inbox:

```http
GET /api/v1/file-inbox
DELETE /api/v1/file-inbox
DELETE /api/v1/file-transfers/<file-id>
```

The sender can inspect independent delivery state for its recent shared Blobs:

```http
GET /api/v1/file-outbox
```

`POST /api/v1/file-transfers/<file-id>/download` creates a 60-second, single-use download URL. The URL contains no device key. Add `?inline=1` to request a safe browser preview when that file type supports it.

### Health check

```http
GET /health
```

## Roadmap

- **0.2.0:** Device identity, one-time pairing, QR pairing, device management, and revocation.
- **0.2.1:** Local clipboard history with source and target devices, timestamps, a 50-entry limit, replay/copy, and scoped clear controls.
- **0.3.0:** Local multi-device routing, named destinations, target-isolated inboxes, and a browser/PWA experience for Mac and mobile devices.
- **0.4.0:** Streamed local file relay, device-scoped file inboxes, safe previews, single-use downloads, quotas, and automatic expiry.
- **0.4.1:** One-to-many text/file sending, shared Blobs, and independent per-recipient delivery status.
- **0.5:** Native Mac relay client with explicit management-device and relay-node roles. Released and verified on Mac hardware.
- **0.6:** HTTPS public web entry, installable PWA, and WebRTC online direct transfer. Released in 0.6.0.
- **0.7:** End-to-end encrypted offline relay.
- **0.8:** Agent Handoff Beta using GitHub project state plus portable Markdown/JSON handoff packages.

## Development

```powershell
npm install
npm test
```

ClipBridge is available under the MIT License.
