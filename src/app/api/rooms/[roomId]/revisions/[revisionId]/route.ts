import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/rooms/[roomId]/revisions/[revisionId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string; revisionId: string }> }
) {
  const { roomId, revisionId } = await params;

  const revision = await prisma.revision.findFirst({
    where: { id: revisionId, roomId },
  });

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  return NextResponse.json(revision);
}

// PATCH /api/rooms/[roomId]/revisions/[revisionId] — update label, status, or sceneUrl
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; revisionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, revisionId } = await params;

  // Verify ownership
  const revision = await prisma.revision.findFirst({
    where: { id: revisionId, roomId },
    include: { room: { include: { project: true } } },
  });

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer || revision.room.project.designerId !== designer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowedFields = ["label", "status", "sceneUrl", "thumbnail", "metadata"] as const;
  const data: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  const updated = await prisma.revision.update({
    where: { id: revisionId },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/rooms/[roomId]/revisions/[revisionId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string; revisionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, revisionId } = await params;

  const revision = await prisma.revision.findFirst({
    where: { id: revisionId, roomId },
    include: { room: { include: { project: true } } },
  });

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer || revision.room.project.designerId !== designer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.revision.delete({ where: { id: revisionId } });

  return NextResponse.json({ success: true });
}
