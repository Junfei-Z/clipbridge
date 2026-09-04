# ClipBridge 0.6 online PWA

Open `https://junfei-z.github.io/clipbridge/` in a current Safari, Chrome, Edge, or Firefox browser. Installation from the browser menu is optional.

## Connect two devices

1. The creator selects **创建连接** and sends the generated invitation code through an existing trusted channel.
2. The joiner selects **加入连接**, pastes the invitation, selects **生成应答码**, and sends the answer back.
3. The creator pastes the answer and selects **完成连接**.
4. Both status badges change to **已直连** when the WebRTC DataChannel is ready.

Invitation and answer codes are one-session WebRTC descriptions. They can expose IP addressing metadata to the intended peer and should not be posted publicly. Reloading either page ends the session.

## Transfer behavior

- Text supports Unicode and stays in memory on the receiving page.
- Files are sent in ordered 48 KiB chunks with backpressure and a progress indicator.
- The receiver calculates SHA-256 and only creates the download when it matches the sender's digest.
- WebRTC encrypts every DataChannel with DTLS. ClipBridge 0.7 will add application-layer end-to-end encryption for offline relay storage.

## Network limitations

The app uses public STUN endpoints for NAT discovery. Two devices behind restrictive corporate, carrier, or symmetric NAT may fail to connect without TURN. ClipBridge 0.6.0 intentionally does not upload content to an unknown fallback relay.

## Install

- iPhone/iPad Safari: **Share → Add to Home Screen**.
- Android Chrome: **Install app** or **Add to Home screen**.
- Desktop Chrome/Edge: use the install button in the address bar or browser menu.

The Service Worker caches only the static application shell so the installed app can open offline. A network connection is still required to establish a WebRTC session with another device.
