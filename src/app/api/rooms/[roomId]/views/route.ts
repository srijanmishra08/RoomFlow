import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSavedViewSchema } from "@/lib/validations";

async function canManageRoom(roomId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return null;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { project: true },
  });

  if (!room || room.project.designerId !== designer.id) return null;
  return room;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const revisionId = req.nextUrl.searchParams.get("revisionId");

  const views = await prisma.savedView.findMany({
    where: {
      roomId,
      ...(revisionId ? { revisionId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(views);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await canManageRoom(roomId, session.user.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found or forbidden" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createSavedViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const created = await prisma.savedView.create({
    data: {
      roomId,
      createdById: session.user.id,
      revisionId: parsed.data.revisionId,
      name: parsed.data.name,
      cameraPosition: parsed.data.cameraPosition,
      cameraRotation: parsed.data.cameraRotation,
      target: parsed.data.target,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
