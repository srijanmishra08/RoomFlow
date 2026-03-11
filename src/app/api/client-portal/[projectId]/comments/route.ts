import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validations";

// POST /api/client-portal/[projectId]/comments – client adds comment on object
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  const body = await req.json();
  const { objectId, content, guestName } = body;

  if (!objectId || !content?.trim()) {
    return NextResponse.json({ error: "objectId and content are required" }, { status: 400 });
  }

  // Verify that the object belongs to this project
  const object = await prisma.roomObject.findUnique({
    where: { id: objectId },
    include: { room: { include: { project: true } } },
  });

  if (!object || object.room.project.id !== projectId) {
    return NextResponse.json({ error: "Object not found in this project" }, { status: 404 });
  }

  // If user is authenticated, use their user id
  if (session?.user?.id) {
    const comment = await prisma.comment.create({
      data: {
        objectId,
        userId: session.user.id,
        content: content.trim(),
      },
      include: {
        user: { select: { name: true, role: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  }

  // For unauthenticated portal access, find assigned client user, or use project's client
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: { include: { user: true } } },
  });

  if (project?.client?.user) {
    const comment = await prisma.comment.create({
      data: {
        objectId,
        userId: project.client.user.id,
        content: `${guestName ? `[${guestName}] ` : ""}${content.trim()}`,
      },
      include: {
        user: { select: { name: true, role: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  }

  return NextResponse.json(
    { error: "Unable to post comment – no client assigned to this project" },
    { status: 403 }
  );
}
