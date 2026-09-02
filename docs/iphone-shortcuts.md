# iPhone Shortcut setup

ClipBridge 0.1 uses two Apple Shortcuts. Replace the example URL and token with the values printed by `npm start`.

## Send to PC

Create a Shortcut named **Send to PC** with these actions:

1. **Get Clipboard**.
2. **Text** containing this JSON, inserting the Clipboard variable in place of `Clipboard`:

   ```json
   {"kind":"text","text":"Clipboard"}
   ```

3. **Get Contents of URL**:
   - URL: `http://YOUR-PC-IP:39393/api/v1/clip`
   - Method: `POST`
   - Request Body: `JSON`
   - Body: use `kind` = `text` and `text` = Clipboard. Prefer the structured JSON fields over manually assembled text.
   - Header `Authorization`: `Bearer YOUR-PAIRING-TOKEN`
4. **Show Notification**: `Sent to Windows`.

You can add this Shortcut to Control Center, the Action Button, Back Tap, or the Share Sheet.

## Get from PC

Create a Shortcut named **Get from PC** with these actions:

1. **Get Contents of URL**:
   - URL: `http://YOUR-PC-IP:39393/api/v1/clip`
   - Method: `GET`
   - Header `Authorization`: `Bearer YOUR-PAIRING-TOKEN`
2. **Get Dictionary Value** `text` from the response.
3. **Copy to Clipboard**.
4. **Show Notification**: `Copied from Windows`.

## Troubleshooting

- Confirm the iPhone and PC are on the same Wi-Fi network.
- On iPhone, allow the Shortcut to access the local network when prompted.
- In Windows Firewall, allow Node.js only for private networks.
- Open `http://YOUR-PC-IP:39393/health` in Safari to confirm basic connectivity.
- If the PC's IP address changes, update both Shortcut URLs. Automatic discovery is planned for the next milestone.

## Privacy warning

Version 0.1 uses unencrypted HTTP. Do not send passwords, recovery codes, private keys, or sensitive work information. Use this prototype only on a trusted private network.
