import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRoomSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// GET /api/projects/[id]/rooms
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rooms = await prisma.room.findMany({
    where: { projectId: id },
    include: {
      objects: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(rooms);
}

// POST /api/projects/[id]/rooms
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = createRoomSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Verify project ownership
  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project || !designer || project.designerId !== designer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const room = await prisma.room.create({
    data: {
      ...parsed.data,
      projectId: id,
    },
  });

  await logActivity(id, session.user.id, "ROOM_CREATED", `Added room "${room.name}"`);

  return NextResponse.json(room, { status: 201 });
}
