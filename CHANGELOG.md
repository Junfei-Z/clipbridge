# Changelog

## 0.5.0 - Unreleased

### Added

- A native macOS menu bar relay client built with AppKit and the existing ClipBridge mascot.
- Native macOS clipboard support through `pbpaste` and `pbcopy`, preserving Unicode text exactly.
- Stable relay-node identity fields and an authenticated `/api/v1/node` discovery endpoint.
- Explicit `management-device` sessions and `relay-node` metadata, capabilities, platform, and access scope.
- A one-command macOS launcher that builds the lightweight app bundle and records the selected Node.js executable.

### Changed

- The local and paired interfaces now describe the management device and relay node as separate roles.
- Windows-specific clipboard and storage language is now relay-aware and renders correctly for Mac nodes.
- Existing Windows configurations migrate automatically to schema v2 while preserving `windows-host` history and file compatibility.
- The legacy `windows-host` target remains accepted as an alias for the active relay node.

## 0.4.1 - 2026-09-03

### Added

- One-to-many text and file sending from Windows or any securely paired device.
- Mobile-friendly multi-select destination cards instead of a single-target dropdown.
- A sender outbox showing independent pending and downloaded status for every file recipient.

### Changed

- Multi-recipient files now share one on-disk Blob while retaining separate target-scoped delivery records.
- Deleting or downloading one delivery no longer changes another recipient's access or state.
- Existing v0.4 single-target file metadata is loaded through an automatic compatibility migration.

## 0.4.0 - 2026-09-03

### Added

- A separate **Text / Files** experience on paired phones, tablets, and Macs, plus a dedicated file relay card on Windows.
- Named-target file transfer for photos, videos, PDFs, SVG, source code, archives, and arbitrary binary files.
- Streaming uploads with aggregate progress, multiple-file queues, and cancellation.
- Target-scoped file inboxes with safe preview, download, single-delete, and clear controls.
- SHA-256 integrity metadata, 24-hour expiry, a 256 MB per-file default limit, and a 1 GB temporary-storage quota.
- Short-lived, single-use download tickets that keep paired-device access keys out of download URLs.

### Security

- File bytes are stored under random IDs and never use the supplied filename as a Windows path.
- Unknown files always download as inert attachments; SVG, HTML, scripts, and source code preview as plain text and are never injected into the ClipBridge page.
- A paired device can only list, preview, download, or delete files addressed to its own identity.
- Revoking either the source or target device removes its queued file transfers.

### Verified

- Automated Windows test suite and GitHub Actions passed.
- Real-device text and file transfer acceptance passed on the local-network workflow.

## 0.3.0 - 2026-09-02

### Added

- Named destination selection for Windows and every securely paired device.
- A persistent, target-isolated inbox with up to 50 pending text transfers per device.
- Direct iPhone-to-Mac, Mac-to-iPhone, and Windows-to-device routing through the local Windows hub.
- Five-second inbox refresh while a paired web app is open, plus copy-and-accept, ignore, and clear controls.
- Peer discovery and multi-device transfer APIs.

### Security

- A paired device can only inspect and consume its own inbox.
- Legacy v0.1 shared-token clients remain limited to Windows clipboard compatibility and cannot use multi-device routing.
- Revoking a device also clears pending content addressed to that device.

## 0.2.1 - 2026-09-02

### Added

- Local persistent history for the latest 50 text transfers explicitly made through ClipBridge.
- Source device, target device, timestamp, copy/replay, single-delete, and clear controls.
- A third **History** tab on paired devices and a dedicated history card on Windows.
- Device-scoped history access so a paired device cannot read or delete another device's transfers.

### Privacy

- History is stored only in `.clipbridge/history.json` on the Windows computer.
- ClipBridge does not monitor unrelated Windows clipboard changes, and clipboard text is still never written to logs.

## 0.2.0 - 2026-09-02

### Added

- Real device pairing with five-minute, single-use 6-digit codes and locally generated QR codes.
- Independent 256-bit access keys and persistent identities for each paired device.
- A Windows device manager showing names, types, and last-seen times.
- Per-device revocation from Windows and self-unpairing from remote devices.
- Pairing attempt rate limits and hashed device-key storage.

### Changed

- The iPhone Home Screen app no longer needs a shared token in its URL.
- Windows loopback access no longer needs an authentication token in the browser address.
- The tray menu copies a device URL; Windows creates explicit one-time pairing sessions.
- v0.1 shared-token links remain available as a clearly labeled migration path.
- README branding now leads with the high-resolution ClipBridge mascot.

## 0.1.5 - 2026-09-02

### Improved

- The quick panel now adapts to where it is opened instead of showing the same three actions everywhere.
- High-density transparent brand artwork keeps the ClipBridge mascot sharp in desktop and mobile page headers.
- Windows localhost opens a focused clipboard manager with **Reload** and **Save to clipboard** actions.
- iPhone, MacBook, and other private-network devices use separate **Send** and **Receive** modes.
- Remote panels show the current device family and Windows host name as a clear two-device connection.
- Ambiguous copy language is replaced with an explicit **Copy to this device** action.
- Remote status and transfer messages now make the source and destination clear.

## 0.1.4 - 2026-09-02

### Added

- A custom soft-jelly ClipBridge mascot replaces the generic Windows tray icon.
- Safari, iPhone Home Screen, browser favicon, and installable web-app metadata now share the same visual identity.
- iPhone Home Screen launches preserve the paired quick-panel URL.

### Improved

- Dedicated icon sizes keep the mascot crisp in tiny Windows tray slots and safely padded inside iOS icon masks.

## 0.1.3 - 2026-09-02

### Fixed

- Chinese, Emoji, accented characters, and multiline text now survive iPhone-to-Windows clipboard transfers exactly.
- Windows-to-iPhone clipboard reads now use the same locale-independent UTF-8 transport.
- PowerShell communication uses Base64-wrapped UTF-8 instead of the active Windows console code page.
- Windows clipboard access uses the native Unicode text format rather than PowerShell's locale-sensitive clipboard cmdlets.

## 0.1.2 - 2026-09-01

### Improved

- The tray launcher records the exact Node process it owns.
- Single-instance locking is scoped to the installation directory, so another ClipBridge copy or an isolated test cannot block it.
- A later launch automatically stops a stale owned ClipBridge service after validating its PID, executable, script path, start time, and instance ID.
- Unrelated Node processes and manually started ClipBridge development servers are never stopped automatically.
- Port conflicts now show a short, actionable explanation instead of the raw Node.js error.

## 0.1.1 - 2026-09-01

### Improved

- Double-click startup now closes the temporary command window immediately.
- The quick panel opens automatically only after the local service passes a health check.
- Startup verifies a per-process instance ID, so another service on the same port cannot be mistaken for a successful launch.
- A single-instance guard prevents duplicate tray and server processes.
- Starting ClipBridge again opens the existing quick panel instead of starting another server.
- Startup failures now show a clear dialog and write diagnostics to `.clipbridge/server-error.log`.
- Tray-mode logs no longer contain the pairing token or private pairing URL.

## 0.1.0 - 2026-09-01

### Added

- Bidirectional plain-text clipboard bridge between Windows and local HTTP clients.
- Apple Shortcuts setup guide for sending to and receiving from an iPhone.
- Authenticated responsive quick panel for no-install mobile testing.
- Windows tray launcher with pairing URL copy action.
- Private-network request filtering and 192-bit pairing tokens.
- Windows clipboard, HTTP API, configuration, network, and UI tests.
- GitHub Actions test workflow.

### Known limitations

- HTTP traffic is not encrypted; use only on a trusted private network.
- iPhone Shortcuts are configured manually in 0.1.
- Only plain text is synchronized.
- A changing PC address requires updating the Shortcut URL.
