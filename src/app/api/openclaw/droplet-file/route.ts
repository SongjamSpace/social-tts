import { NextResponse } from "next/server";
import { Readable } from "stream";
import path from "path";
import fs from "fs";
import os from "os";
import { put } from "@vercel/blob";
import { getAdminFirestore } from "@/services/firebase-admin.service";

const OPENCLAW_DROPLET_TOKENS = "openclaw_droplet_tokens";

/**
 * GET /api/openclaw/droplet-file?t=TOKEN
 * One-time use: returns the .droplet file. When BLOB_READ_WRITE_TOKEN is set, uploads to Vercel Blob and redirects to the blob URL so Android's download manager receives the file from CDN (same as APK from GitHub). Otherwise streams from a temp file.
 */
export async function GET(request: Request) {
  let tempPath: string | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("t")?.trim();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection(OPENCLAW_DROPLET_TOKENS).doc(token);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json(
        { error: "Link expired or already used" },
        { status: 404 }
      );
    }

    const data = snap.data()!;
    const bundle = data.bundle as string;
    const mint = (data.mint as string) ?? "";

    await docRef.delete();

    const filename = `openclaw-${mint ? mint.slice(0, 8) : "droplet"}.droplet`;

    // Prefer Vercel Blob: serve file from CDN so Android download manager gets it (same pattern as APK from GitHub).
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const pathname = `openclaw-droplet/${token}.droplet`;
      const body = Buffer.from(bundle, "utf8");
      const blob = await put(pathname, body, {
        access: "public",
        contentType: "application/octet-stream",
        addRandomSuffix: false,
      });
      const downloadUrl = blob.downloadUrl ?? `${blob.url}?download=1`;
      return NextResponse.redirect(downloadUrl, 302);
    }

    tempPath = path.join(os.tmpdir(), `droplet-${token}.droplet`);

    await fs.promises.writeFile(tempPath, bundle, "utf8");
    const stat = await fs.promises.stat(tempPath);

    const pathToDelete = tempPath;
    const nodeStream = fs.createReadStream(pathToDelete);
    nodeStream.on("end", () => {
      try {
        if (pathToDelete) fs.unlinkSync(pathToDelete);
      } catch {
        // ignore
      }
    });
    nodeStream.on("error", () => {
      try {
        if (pathToDelete) fs.unlinkSync(pathToDelete);
      } catch {
        // ignore
      }
    });

    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(stat.size),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (tempPath) {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
    console.error("[openclaw/droplet-file]", e);
    return NextResponse.json(
      { error: "Failed to fetch droplet file" },
      { status: 500 }
    );
  }
}
