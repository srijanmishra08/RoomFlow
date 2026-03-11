import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createObjectSchema, updateObjectSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// GET /api/rooms/[roomId]/objects
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  const objects = await prisma.roomObject.findMany({
    where: { roomId },
    include: {
      comments: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(objects);
}

// POST /api/rooms/[roomId]/objects
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const body = await req.json();
  const parsed = createObjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const obj = await prisma.roomObject.create({
    data: {
      ...parsed.data,
      roomId,
    },
  });

  // Log activity (find project from room)
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { projectId: true } });
  if (room) {
    await logActivity(room.projectId, session.user.id, "OBJECT_ADDED", `Added object "${obj.name}"`);
  }

  return NextResponse.json(obj, { status: 201 });
}
