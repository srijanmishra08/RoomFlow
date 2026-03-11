import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/activities
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const take = 20;

  // Verify ownership
  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || !designer || project.designerId !== designer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activities = await prisma.activity.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { name: true, image: true } },
    },
  });

  const hasMore = activities.length > take;
  const items = hasMore ? activities.slice(0, take) : activities;

  return NextResponse.json({
    activities: items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}

// POST /api/projects/[id]/activities - Log an activity
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

  const activity = await prisma.activity.create({
    data: {
      projectId: id,
      userId: session.user.id,
      type: body.type,
      message: body.message,
      metadata: body.metadata || undefined,
    },
    include: {
      user: { select: { name: true, image: true } },
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
