# Changelog

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
