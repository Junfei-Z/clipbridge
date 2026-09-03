<p align="center">
  <img src="assets/icon-512.png" width="128" height="128" alt="ClipBridge mascot">
</p>

<h1 align="center">ClipBridge</h1>

<p align="center"><strong>A lightweight, local-first clipboard bridge for the devices you already use.</strong></p>

ClipBridge transfers text and files between a Windows PC, iPhone, Android phone, Mac, and other devices on the same trusted private network. Version 0.4.1 can send one payload to several devices while storing only one copy of each file Blob, without requiring a cloud account or uploading content to a third-party service.

## What works in 0.4.1

- Pair an iPhone, iPad, Mac, Android device, or another computer with a one-time 6-digit code or local QR code.
- Give every paired device an independent 256-bit access key.
- Store only SHA-256 key hashes on Windows, never the usable device keys.
- View paired device names and last-seen times from the Windows panel.
- Revoke one device without breaking access for the others.
- Send Unicode plain text to Windows and retrieve the current Windows clipboard.
- Use a focused clipboard manager on Windows and direction-aware **Send** / **Receive** modes remotely.
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

Pairing and authorization are device-specific in 0.4.1, but transport is still ordinary HTTP and is **not encrypted**. Run ClipBridge only on a trusted private network. Do not expose port `39393` to the internet, use it on public Wi-Fi, or transfer passwords, verification codes, private keys, or sensitive work material.

Pairing codes expire after five minutes, work once, and rate-limit incorrect guesses. QR codes are generated locally; ClipBridge does not send pairing links or clipboard content to a QR service or other cloud service.

## Requirements

- Windows 10 or later
- Node.js 20 or later
- Windows and the other device connected to the same trusted Wi-Fi or private LAN

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

### Pair an iPhone or another device

1. Open ClipBridge on the Windows PC.
2. Under **Paired devices**, choose **Pair new device**.
3. Scan the local QR code with the iPhone camera, or open the copied device URL and enter the 6-digit code.
4. Confirm the device name and type, then choose **Secure pair**.
5. The device keeps its own access key in local browser storage. The key is not placed in the URL.

From Windows you can later review the device and choose **Revoke**. The revoked device immediately loses clipboard access while every other paired device continues working.

### Send between iPhone, Mac, and Windows

1. Pair each device with the same Windows ClipBridge service.
2. Open **Send** and choose one or more named target devices.
3. Sending to Windows writes immediately to the Windows clipboard.
4. Sending to another paired device places the text in that device's private inbox on Windows.
5. The target opens **Receive**, chooses **Copy and accept**, and the item leaves its inbox while remaining available in scoped history.

The Windows hub must be running and every device must be on the same trusted private network. The target browser does not have to remain open while a text is queued.

### Send a file from Android to iPhone through Windows

1. Pair both the Android phone and iPhone with the same Windows ClipBridge service.
2. On Android, open ClipBridge and switch from **Text** to **Files**.
3. Choose the paired iPhone and any other intended recipients, select one or more files, and choose **Send files**.
4. Windows stores one inert temporary Blob per file and creates an independent delivery record for every target; it does not open or execute the file.
5. On iPhone, open **Files**, then open, download, or delete the item from that device's private file inbox.

The default limits are 256 MB per file, 1 GB of temporary file storage, and 24-hour retention. They can be changed in `.clipbridge/config.json`. iOS requires an explicit tap to download or save a received file; a local HTTP web app cannot silently write into Photos or Files.

### Add ClipBridge to the iPhone Home Screen

After pairing in Safari, tap **Share**, then **Add to Home Screen**. The saved app opens without a token in its URL and uses the same ClipBridge icon as Windows. Safari may require manual long-press copying because clipboard APIs are restricted on non-HTTPS local pages.

### If startup fails

ClipBridge shows an error dialog instead of leaving an empty command window. Diagnostic details are written to `.clipbridge/server-error.log`. You can also run `npm start` in PowerShell to see the service output directly.

## Stored data

ClipBridge keeps local settings in `.clipbridge/`:

- `config.json` contains the port, Windows name, and the legacy v0.1 migration token.
- `devices.json` contains device metadata and key hashes. Usable per-device keys are never written there.
- `history.json` contains up to 50 text transfers explicitly made through ClipBridge, including source, target, and timestamp.
- `inbox.json` contains up to 50 pending texts per target device until that device accepts, ignores, or clears them.
- `files.json` contains shared Blob metadata and separate per-target delivery states, including source, target, size, checksum, and expiry time.
- `files/` contains opaque temporary file blobs. Original filenames are never used as disk paths.

ClipBridge does not watch or index every Windows clipboard change. History stays on the Windows computer: its local panel can see all entries, while a paired device only receives entries in which that device is the source or target. Single entries and the visible history scope can be cleared from either interface.

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

{"kind":"text","text":"Hello everyone","targetIds":["windows-host","<iphone-id>","<mac-id>"]}
```

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
- **0.5:** Native Mac relay client with explicit management-device and relay-node roles.
- **0.6:** HTTPS public web entry, installable PWA, and WebRTC online direct transfer.
- **0.7:** End-to-end encrypted offline relay.
- **0.8:** Agent Handoff Beta using GitHub project state plus portable Markdown/JSON handoff packages.

## Development

```powershell
npm install
npm test
```

ClipBridge is available under the MIT License.
