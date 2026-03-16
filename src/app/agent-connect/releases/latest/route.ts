import { NextResponse } from "next/server";

/** Default: GitHub release DMG (SongjamSpace/agent-connect). Override with NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL. */
const GITHUB_RELEASE_DMG_URL =
  "https://github.com/SongjamSpace/agent-connect/releases/download/v0.1.0/Agent-Connect-0.1.0.dmg";

/**
 * GET /agent-connect/releases/latest
 * If NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL is set, redirects there. Otherwise redirects to the GitHub release .dmg.
 */
export function GET(request: Request) {
  const override = process.env.NEXT_PUBLIC_AGENT_CONNECT_DOWNLOAD_URL?.trim();
  if (override) {
    return NextResponse.redirect(override, 302);
  }
  return NextResponse.redirect(GITHUB_RELEASE_DMG_URL, 302);
}
