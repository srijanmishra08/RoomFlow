import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSavedViewSchema } from "@/lib/validations";

async function canManageRoom(roomId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return false;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { project: true },
  });
  return !!room && room.project.designerId === designer.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; viewId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, viewId } = await params;
  if (!(await canManageRoom(roomId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const view = await prisma.savedView.findUnique({ where: { id: viewId } });
  if (!view || view.roomId !== roomId) {
    return NextResponse.json({ error: "View not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSavedViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await prisma.savedView.update({
    where: { id: viewId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string; viewId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, viewId } = await params;
  if (!(await canManageRoom(roomId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const view = await prisma.savedView.findUnique({ where: { id: viewId } });
  if (!view || view.roomId !== roomId) {
    return NextResponse.json({ error: "View not found" }, { status: 404 });
  }

  await prisma.savedView.delete({ where: { id: viewId } });
  return NextResponse.json({ message: "Deleted" });
}
