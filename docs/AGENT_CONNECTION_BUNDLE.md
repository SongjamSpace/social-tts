# Agent Connect connection bundle format

The connection bundle is a JSON file (`.opencaw`) generated **client-side only** on the spawn success page. It is used by the Agent Connect desktop app to connect to a droplet via SSH.

## Format

```json
{
  "version": 1,
  "host": "<droplet IP>",
  "port": 22,
  "user": "root",
  "privateKeyPem": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----",
  "mint": "<optional token mint>",
  "label": "<optional display label>"
}
```

- **version**: Must be `1`.
- **host**: Droplet public IP.
- **port**: SSH port (default 22).
- **user**: SSH user (root for spawn droplets).
- **privateKeyPem**: Full OpenSSH private key PEM. **Secret** – treat like a .pem file.
- **mint**: Optional launch mint for reference.
- **label**: Optional label (e.g. agent name) for the app UI.

## Troubleshooting

- If connection fails (e.g. "All configured authentication methods failed" or "connection refused"), wait 1–2 minutes after the droplet appears and try again. The droplet may still be finishing setup.

## Security

- The file **contains the private key**. The user is responsible for storage and deletion.
- Never send the bundle or private key to the backend; it is generated and downloaded only in the browser.
- Agent Connect may store the key in the system keychain (e.g. macOS Keychain) after import; the bundle file itself should be deleted or kept in a secure location.
