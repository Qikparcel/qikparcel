import { NextRequest, NextResponse } from "next/server";
import { writeFile, appendFile, access } from "fs/promises";
import { join } from "path";

const LOG_PATH = join(process.cwd(), ".cursor", "debug.log");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const line =
    JSON.stringify({
      ...body,
      timestamp: (body as any)?.timestamp ?? Date.now(),
    }) + "\n";
  try {
    await appendFile(LOG_PATH, line);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      const { mkdir } = await import("fs/promises");
      await mkdir(join(process.cwd(), ".cursor"), { recursive: true });
      await appendFile(LOG_PATH, line);
    } else {
      return NextResponse.json({ error: String(e?.message) }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
