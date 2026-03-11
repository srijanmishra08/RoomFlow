import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProjectSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// GET /api/projects/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: { include: { user: { select: { name: true, email: true } } } },
      rooms: {
        include: {
          objects: {
            include: { comments: { include: { user: { select: { name: true } } } } },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify ownership
  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer || project.designerId !== designer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(project);
}

// PATCH /api/projects/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing || !designer || existing.designerId !== designer.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: parsed.data,
  });

  const changes = Object.keys(parsed.data).join(", ");
  await logActivity(id, session.user.id, "PROJECT_UPDATED", `Updated project: ${changes}`);

  return NextResponse.json(project);
}

// DELETE /api/projects/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing || !designer || existing.designerId !== designer.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ message: "Project deleted" });
}
