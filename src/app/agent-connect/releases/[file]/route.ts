import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

const AGENT_DMG_FILENAME = "Agent-Connect-0.1.0.dmg";
const AGENT_APK_FILENAME = "Agent-Connect-0.1.0.apk";
const ALLOWED_RELEASE_FILES = [AGENT_DMG_FILENAME, AGENT_APK_FILENAME] as const;

/**
 * GET /agent-connect/releases/[file]
 * Serves the .dmg or .apk from public if it exists; otherwise 404 with plain text.
 * This avoids the request hitting the app layout (and Privy) when the file is missing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (!ALLOWED_RELEASE_FILES.includes(file as (typeof ALLOWED_RELEASE_FILES)[number])) {
    return new NextResponse("Not found", { status: 404 });
  }
  const publicDir = path.join(process.cwd(), "public", "agent-connect", "releases");
  const filePath = path.join(publicDir, file);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }
    const nodeStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file}"`,
        "Content-Length": String(stat.size),
      },
    });
  } catch {
    return new NextResponse("File not found. Add the .dmg or .apk to public/agent-connect/releases/", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
