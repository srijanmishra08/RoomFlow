import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createApprovalSchema } from "@/lib/validations";

// POST /api/client-portal/[projectId]/approvals – client approves/rejects object
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { objectId, status, note } = body;

  if (!objectId) {
    return NextResponse.json({ error: "objectId is required" }, { status: 400 });
  }

  const parsed = createApprovalSchema.safeParse({ status, note });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Verify object belongs to project
  const object = await prisma.roomObject.findUnique({
    where: { id: objectId },
    include: { room: { include: { project: true } } },
  });

  if (!object || object.room.project.id !== projectId) {
    return NextResponse.json({ error: "Object not found in this project" }, { status: 404 });
  }

  // Find the client user
  const session = await auth();
  let userId: string;

  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });
    if (!project?.client?.userId) {
      return NextResponse.json({ error: "No client assigned" }, { status: 403 });
    }
    userId = project.client.userId;
  }

  const approval = await prisma.approval.upsert({
    where: {
      id: await prisma.approval
        .findFirst({
          where: { objectId, userId },
          select: { id: true },
        })
        .then((a) => a?.id ?? ""),
    },
    update: {
      status: parsed.data.status,
      note: parsed.data.note,
    },
    create: {
      objectId,
      userId,
      status: parsed.data.status,
      note: parsed.data.note,
    },
    include: {
      user: { select: { name: true } },
    },
  });

  // If approved, optionally update object status to FINALIZED
  if (parsed.data.status === "APPROVED") {
    await prisma.roomObject.update({
      where: { id: objectId },
      data: { status: "FINALIZED" },
    });
  }

  return NextResponse.json(approval, { status: 201 });
}

// GET /api/client-portal/[projectId]/approvals – get approvals for project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      rooms: {
        include: {
          objects: {
            include: {
              approvals: {
                include: { user: { select: { name: true } } },
                orderBy: { updatedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Flatten to a map of objectId → latest approval
  const approvalMap: Record<string, any> = {};
  for (const room of project.rooms) {
    for (const obj of room.objects) {
      if (obj.approvals.length > 0) {
        approvalMap[obj.id] = obj.approvals[0];
      }
    }
  }

  return NextResponse.json(approvalMap);
}
