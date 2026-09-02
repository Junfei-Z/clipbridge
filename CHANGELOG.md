# Changelog

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
