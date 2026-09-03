# ClipBridge public web entry

The static app in `web/` is designed for the GitHub project-page URL:

```text
https://junfei-z.github.io/clipbridge/
```

It is deliberately a public entry point rather than a relay server. GitHub Pages serves only the installable interface. In the first Web Foundation release, the page detects the current device, validates a private-network pairing URL, and performs a top-level navigation to the user's own ClipBridge Hub.

## Privacy boundary

- The pairing URL and its one-time code are never sent to GitHub Pages with `fetch`, analytics, forms, or logs.
- The pairing URL is not written to local storage, IndexedDB, cookies, or the service-worker cache.
- Only HTTP(S) URLs using loopback, private IPv4, link-local/ULA IPv6, or `.local` hostnames are accepted.
- The public PWA cache contains only its own application shell and brand assets.
- ClipBridge content continues to flow through the user's local Hub; GitHub Pages never receives clipboard text or file bytes.

## Deployment

`.github/workflows/pages.yml` tests the repository and uploads `web/` as the Pages artifact. All browser assets use relative URLs, and the manifest plus service worker use a relative scope so the app remains under `/clipbridge/` rather than claiming the owner's entire Pages origin.

Before the first deployment, configure the repository's Pages source as **GitHub Actions**. Deployment runs automatically after Web Foundation reaches `main`; it can also be started manually from the Actions tab.

## Future transport

The static entry does not yet provide public-network device discovery. A later release can add a small HTTPS signaling service and encrypted WebRTC DataChannels. Offline delivery requires a separate relay that stores only client-encrypted, expiring blobs. Neither capability belongs in GitHub Pages itself.
