import { NextResponse } from "next/server";

const AGENT_DMG_FILENAME = "Agent-Connect-0.1.0.dmg";

/**
 * GET /agent-connect/releases/latest
 * If NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL is set, redirects there.
 * Otherwise returns a minimal HTML download page (no React/Privy) with a link to the .dmg.
 */
export function GET(request: Request) {
  const override = process.env.NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL?.trim();
  if (override) {
    return NextResponse.redirect(override, 302);
  }
  const dmgUrl = `${request.nextUrl.origin}/agent-connect/releases/${AGENT_DMG_FILENAME}`;
  const damagedNote =
    '<p style="font-size: 0.875rem; color: #9ca3af; max-width: 28rem; margin: 1rem auto 0;">If macOS says the app is "damaged", run in Terminal: <code style="font-size: 0.8em;">xattr -cr "/Applications/Agent Connect.app"</code> or right-click the app → Open.</p>';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download Agent Connect</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #060608; color: #e5e5e5; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    a { color: #ef4444; font-weight: 600; }
    a:hover { text-decoration: underline; }
    .box { text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Agent Connect</h1>
    <p>Download the Mac app to connect to your droplet and install your agent.</p>
    <p><a href="${dmgUrl}">Download Agent Connect (Mac .dmg)</a></p>
    ${damagedNote}
    <p style="font-size: 0.875rem; color: #737373;">If the download doesn't start, add the built .dmg to <code>public/agent-connect/releases/</code> or set <code>NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL</code>.</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
