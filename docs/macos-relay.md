# ClipBridge macOS relay node

Version 0.5 allows either a Windows PC or a Mac to host the local ClipBridge relay. A relay node owns the clipboard integration, pairing registry, text history, queued inboxes, and temporary file Blobs. Phones and browsers are management/endpoint devices; they do not become background servers.

## Requirements

- macOS 12 or later
- Node.js 20 or later
- Apple Command Line Tools (`xcode-select --install`)

### Gatekeeper and downloaded source archives

When the project came from a browser download, macOS may attach quarantine metadata to every extracted file. ClipBridge v0.5.2 runs the nested build script through the trusted system `/bin/bash`, removes inherited quarantine only from the generated app bundle, and ad-hoc signs the locally compiled app.

The menu bar app is compiled with Apple's Objective-C/AppKit toolchain. This avoids a failure mode after a partial Command Line Tools update, where `swiftc` and the bundled SDK contain different Swift compiler patch builds and importing AppKit fails even though both report the same public Swift version.

You may still need to right-click `Start-ClipBridge-Mac.command` and choose **Open** the first time. ClipBridge deliberately does not remove quarantine metadata from the downloaded folder.
- All participating devices on the same trusted private network

## Start

Install dependencies once from Terminal:

```bash
npm install
```

Then double-click `Start-ClipBridge-Mac.command`, or run:

```bash
./Start-ClipBridge-Mac.command
```

The launcher compiles a small native AppKit menu bar app into `dist/ClipBridge.app`, opens it, and keeps the Node.js relay service hidden. The menu bar icon can open the management panel, copy the LAN device URL, or stop the relay.

The build records the exact Node.js executable path inside the generated app so it still starts when Finder does not inherit a Homebrew shell path. The generated `dist/` app is local build output and should not be committed.

## Roles

- **Relay node:** the Windows PC or Mac running the ClipBridge service and holding local data.
- **Management device:** the browser interface used to configure or operate a relay. A loopback management session can pair and revoke devices; a paired remote session can only use its own scoped transfers.
- **Endpoint device:** any paired iPhone, iPad, Android, Mac, or Windows browser that sends and receives content.

One physical computer can be both a relay node and the device displaying its local management panel. They are still separate software roles and are reported separately by the API.

## Current limitation

The macOS AppKit source and cross-platform Node behavior are tested from the repository, but the final `.app` bundle must be compiled and accepted on real Mac hardware before v0.5 is considered fully hardware-validated. Version 0.5 remains local HTTP and must not be exposed to the internet.
