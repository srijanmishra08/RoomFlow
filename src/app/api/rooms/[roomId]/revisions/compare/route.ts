import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const fromId = req.nextUrl.searchParams.get("from");
  const toId = req.nextUrl.searchParams.get("to");

  if (!fromId || !toId) {
    return NextResponse.json({ error: "from and to revision ids are required" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.revision.findUnique({ where: { id: fromId } }),
    prisma.revision.findUnique({ where: { id: toId } }),
  ]);

  if (!from || !to || from.roomId !== roomId || to.roomId !== roomId) {
    return NextResponse.json({ error: "Revisions not found in this room" }, { status: 404 });
  }

  return NextResponse.json({
    roomId,
    from: {
      id: from.id,
      version: from.version,
      label: from.label,
      sceneUrl: from.sceneUrl,
      sourceFileUrl: from.sourceFileUrl,
      metadata: from.metadata,
      status: from.status,
    },
    to: {
      id: to.id,
      version: to.version,
      label: to.label,
      sceneUrl: to.sceneUrl,
      sourceFileUrl: to.sourceFileUrl,
      metadata: to.metadata,
      status: to.status,
    },
    delta: {
      versionDelta: to.version - from.version,
      changedScene: from.sceneUrl !== to.sceneUrl,
      changedSource: from.sourceFileUrl !== to.sourceFileUrl,
      fromStatus: from.status,
      toStatus: to.status,
    },
  });
}
