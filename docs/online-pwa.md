# ClipBridge 0.6 online PWA

Open `https://junfei-z.github.io/clipbridge/transfer.html` in a current Safari, Chrome, Edge, or Firefox browser. Installation from the browser menu is optional. The project introduction remains at `https://junfei-z.github.io/clipbridge/`.

## Connect two devices

1. The creator selects **创建连接** to receive a temporary 6-digit room code and QR code.
2. The joiner selects **加入连接** and enters the code, or scans the QR code.
3. Both status badges change to **已直连** when the WebRTC DataChannel is ready.

The room expires after five minutes and accepts only a creator and one joiner. A Cloudflare Durable Object forwards the temporary WebRTC offer and answer, then the browser closes the signaling WebSocket as soon as the direct connection opens. The signaling service never receives transferred text or files. Reloading either page ends the session.

## Transfer behavior

- Text supports Unicode and stays in memory on the receiving page.
- Files are sent in ordered 48 KiB chunks with backpressure and a progress indicator.
- The receiver calculates SHA-256 and only creates the download when it matches the sender's digest.
- WebRTC encrypts every DataChannel with DTLS. ClipBridge 0.7 will add application-layer end-to-end encryption for offline relay storage.

## Network limitations

The app uses public STUN endpoints for NAT discovery. Two devices behind restrictive corporate, carrier, or symmetric NAT may fail to connect without TURN. ClipBridge intentionally does not upload content to an unknown fallback relay. The short-code service is hosted at `clipbridge-signal.junfei.workers.dev`; networks that block `workers.dev` need an accessible custom Worker domain.

## Install

- iPhone/iPad Safari: **Share → Add to Home Screen**.
- Android Chrome: **Install app** or **Add to Home screen**.
- Desktop Chrome/Edge: use the install button in the address bar or browser menu.

The Service Worker caches only the static application shell so the installed app can open offline. A network connection is still required to establish a WebRTC session with another device.
