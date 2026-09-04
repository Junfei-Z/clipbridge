# Changelog

## 0.7.12 - 2026-09-04

### Added

- Added a top-right Chinese/English language control to the local relay, paired-device, Agent Handoff, and public WebRTC interfaces.
- The first visit follows the browser language and subsequent visits remember the choice locally on each device.
- Added a fully English Agent Handoff prompt plus localized dynamic statuses, confirmation dialogs, dates, accessibility labels, and error messages.

### Safety

- User clipboard text, file names, device names, repository paths, and handoff contents are excluded from interface translation.

### Verified

- Browser interaction verified English and Chinese rendering and persisted switching in both the local relay and public PWA.
- All automated checks pass locally; the release commit intentionally skips hosted CI to preserve the repository's Actions allowance.

## 0.7.11 - 2026-09-04

### Fixed

- Made the real Git fast-forward integration test portable on Windows by using a platform-neutral file URL and normalizing checkout line endings.
- Upgraded the official checkout and Node setup Actions to their Node.js 24 releases, removing the Node.js 20 deprecation warnings.

### Verified

- The full test matrix passes on both Windows and macOS, including the native macOS application build.

## 0.7.10 - 2026-09-04

### Fixed

- Replaced the old mascot everywhere it was still shipped, including the public GitHub Pages PWA.
- Restored the redesigned master to the established 1024×1024 dimensions instead of changing the source asset size.

### Verified

- Automated checks lock every PNG to its previous dimensions, the favicon to three resolutions, and the Windows tray icon to nine resolutions.
- The private application repository and public homepage now serve the same redesigned mascot assets.

## 0.7.9 - 2026-09-04

### Changed

- Split the Agent Handoff component into explicit **Send handoff** and **Receive handoff** roles with large, persistent role selectors.
- Shared GitHub account, project preparation, environment, and computer registration stay above the role switch; each role shows only the actions it needs.
- Receiving task cards now show the handoff goal and sending computer name instead of leading with an opaque package id.
- Publishing keeps the sender in the send flow and presents a clear completion message.

### Verified

- Browser interaction confirms that send and receive panels are mutually exclusive and retain correct ARIA selection state.
- All automated tests pass and the native macOS app builds successfully.

## 0.7.8 - 2026-09-04

### Changed

- Redesigned the ClipBridge mascot for 16–48 px clarity while preserving the cute purple-blue clipboard robot and bridge identity.
- Replaced fragile bridge railings with one bold outlined arch, enlarged the eyes, simplified the top clip, and added a continuous dark-indigo silhouette keyline.
- Rebuilt the web, PWA, favicon, Windows tray, and macOS application icon assets from one transparent high-resolution master.

### Added

- A reproducible macOS icon build script that produces optimized PNG sizes, multi-resolution ICO files, and a complete ICNS bundle.
- A real `CFBundleIconFile` entry for the native macOS application.

### Verified

- The mascot remains recognizable at 16 px and preserves both the eyes and bridge at 32 px.
- All automated tests pass and the native macOS application builds and signs with the new ICNS resource.

## 0.7.7 - 2026-09-04

### Added

- Native project-folder selection for existing repositories on macOS and Windows, with a Linux desktop fallback.
- Safe existing-project updates using `fetch --prune` and fast-forward-only merges.
- Automatic environment recheck and Agent computer registration after a successful update.

### Safety

- Updates stop before changing files when the working tree is dirty, the current checkout is detached, the remote branch is missing, or local and remote histories have diverged.
- Local commits that have not been pushed are reported instead of being overwritten or hidden.

### Verified

- A real two-clone Git test fast-forwarded an outdated project and rejected a subsequent dirty-worktree update.
- All 63 automated tests pass and the native macOS app builds successfully.

## 0.7.6 - 2026-09-04

### Added

- Local GitHub CLI account detection without exposing authentication tokens to the management page.
- A repository picker populated from the signed-in GitHub account.
- One-click cloning into the cross-platform `ClipBridge Projects` directory, followed by automatic environment detection and Agent computer registration.
- Clear guidance and a copyable secure login command when GitHub CLI is not authenticated.

### Security

- Only GitHub HTTPS and SSH repository URLs are accepted by the clone endpoint.
- Clone operations are local-only, non-interactive, and remove partial destination directories after failure.

### Verified

- A real signed-in GitHub account loaded 32 repositories without returning credentials, and the fixed clone directory rendered correctly.
- All 62 automated tests pass and the native macOS app builds successfully.

## 0.7.5 - 2026-09-04

### Added

- Repository-backed Agent computer registration with stable ClipBridge node identities and human-readable device names.
- Discovery of Agent-capable computers through dedicated GitHub branches without touching the active project branch or working tree.
- One-device, multi-device, or all-computer delivery selection in the Agent Handoff UI.
- Targeted handoff metadata and receiver-side filtering so unrelated Agent computers do not see directed tasks.

### Verified

- Three simulated computers discovered one another and the sender selected a Windows target by name.
- Registration preserves the active branch and clean working tree; targeted handoffs are visible only to selected recipients.
- All 60 automated tests pass and the native macOS app builds successfully.

## 0.7.4 - 2026-09-04

### Changed

- Agent Handoff now shows its real connection target: the selected GitHub repository, rather than implying a direct connection to one computer.
- The connection banner explains that every authorized computer can fetch the published handoff and that delivery is not currently device-targeted.
- The primary action is renamed to “Publish handoff to this repository” for a clearer mental model.

## 0.7.3 - 2026-09-04

### Added

- A copyable official prompt that asks the current Agent for a structured, portable handoff response.
- One paste box that automatically maps the Agent's complete response into the handoff package, replacing three manual context fields.
- Automatic readiness indicators for Node.js, Git, the selected Git repository, and its GitHub origin.

### Verified

- The structured response parser preserves Chinese handoff content and falls back safely for free-form Agent replies.
- All 58 automated tests pass, and the revised desktop workflow was exercised in the browser.

## 0.7.2 - 2026-09-04

### Added

- A desktop management UI for creating, fetching, inspecting, and applying Agent Handoff packages.
- A clear three-mode navigation for text, files, and Agent Handoff.
- Explicit computer-only labels on both desktop and paired-device pages; phones and tablets remain text/file endpoints.

### Changed

- The local management interface is split into focused text, file, and Agent workspaces for a shorter, cleaner workflow.
- Local Agent errors now surface actionable Git or repository details instead of the generic clipboard error.

### Verified

- All 56 automated tests pass, including UI-script parsing and computer-only annotations.
- The three workspaces and Agent restriction notice were visually checked in the local browser UI.

## 0.7.1 - 2026-09-04

### Fixed

- The cross-device handoff test now accepts Git's expected CRLF checkout behavior on Windows while still asserting exact Unicode content.

## 0.7.0 - 2026-09-04

### Added

- Agent Handoff Beta with portable `HANDOFF.md`, `state.json`, and SHA-256-verified binary Git patch packages.
- Separate `clipbridge/handoff/<id>` branches that preserve the sender's current branch, index, and working tree.
- `create`, `list --fetch`, `inspect`, and clean-tree `apply` commands for cross-device Git repository handoff.
- File-based goal, summary, and next-action inputs so an agent can provide structured context without shell-length limits.
- Credential-pattern blocking and default omission of all untracked files, raw sessions, environment variables, and clipboard data.

### Changed

- Agent Handoff moves forward from the former 0.8 roadmap slot to 0.7. The experimental 0.6 WebRTC interface remains published, but active feature development is paused.

### Verified

- A real temporary source repository produced a handoff without changing its active branch or dirty working tree.
- A separate clean clone fetched, inspected, checksum-verified, and applied a Unicode patch successfully.
- All 56 automated tests pass, and the native macOS app still builds and signs successfully.

## 0.6.2 - 2026-09-04

### Added

- Six-digit temporary room codes and local QR codes replace multi-kilobyte manual WebRTC descriptions.
- A Cloudflare Worker and per-room SQLite Durable Object automatically exchange only the WebRTC offer and answer over hibernatable WebSockets.
- Five-minute room expiry, a two-device limit, creator tokens, allowed-origin checks, and bounded signaling messages.

### Verified

- All 53 automated tests and the Wrangler deployment dry-run pass.
- Local end-to-end browser testing created a six-digit room, connected two tabs automatically, and preserved Chinese text and emoji.

## 0.6.1 - 2026-09-04

### Fixed

- `npm test` now builds the static PWA first, so clean Windows and macOS CI runners can verify the generated offline shell and icons.

## 0.6.0 - 2026-09-04

### Added

- A public, subpath-safe PWA for `junfei-z.github.io/clipbridge` with an installable manifest, responsive UI, and offline application shell.
- Backend-free WebRTC offer/answer pairing through one-time connection codes.
- Encrypted peer-to-peer DataChannel transfer for Unicode text and arbitrary files.
- 48 KiB file chunking, sender backpressure, progress reporting, and SHA-256 receiver verification.
- A GitHub Pages deployment workflow and reproducible static-site build.

### Privacy

- GitHub Pages serves only static application assets and never receives transferred text or files.
- Connection codes contain ephemeral WebRTC negotiation metadata and should be shared only with the intended peer.
- Received content is held only by the current page and is cleared when the page is refreshed.

### Verified

- Two independent browser pages completed WebRTC negotiation and transferred Unicode text.
- A Unicode test file passed chunked transfer and SHA-256 verification with no browser console errors.
- All 52 automated tests passed before release.

## 0.5.3 - 2026-09-04

### Fixed

- The default Windows and macOS clipboard modules are now adapted to the `readText`/`writeText` contract used by the HTTP relay instead of exposing mismatched export names.
- Unexpected relay request failures now log their route and underlying error without logging clipboard contents.
- macOS `pbcopy` and `pbpaste` now run with an explicit UTF-8 locale, preserving Chinese and other Unicode text when ClipBridge is launched from Finder rather than Terminal.
- The native Mac app now supplies an AppKit clipboard helper that decodes and encodes UTF-8 explicitly, avoiding locale-dependent `pbcopy` mojibake when launched from Finder.

## 0.5.2 - 2026-09-04

### Fixed

- The native menu bar app now builds with Objective-C/AppKit, avoiding Swift compiler/SDK patch-build mismatches caused by partial Apple Command Line Tools updates.
- Quarantine metadata inherited by copied resources is removed from the generated app bundle before signing, without changing the downloaded source folder.
- The generated app now resolves the project root above `dist/` correctly, so it can find and start `src/server.mjs`.
- The Objective-C app delegate now has process-lifetime ownership, keeping the menu bar relay alive after launch.

### Verified

- Native arm64 build, ad-hoc signature verification, menu bar launch, Node relay startup, and `/health` passed on Mac hardware.
- All 49 automated tests passed.

## 0.5.1 - 2026-09-03

### Fixed

- The macOS launcher now asks the trusted system `/bin/bash` to read `build-app.sh`, preventing Gatekeeper from treating the quarantined child script as a second unverified application.
- Locally compiled menu bar bundles now receive an ad-hoc code signature before they are opened.

## 0.5.0 - 2026-09-03

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
