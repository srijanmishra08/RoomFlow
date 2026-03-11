import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRoomSchema } from "@/lib/validations";

// PATCH /api/rooms/[roomId] – update room
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const body = await req.json();
  const parsed = updateRoomSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Verify ownership via project → designer
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { project: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer || room.project.designerId !== designer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/rooms/[roomId] – delete room
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { project: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer || room.project.designerId !== designer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.room.delete({ where: { id: roomId } });

  return NextResponse.json({ success: true });
}
