import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDriveItemSchema } from "@/lib/validations";

async function canAccessProject(projectId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return false;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return !!project && project.designerId === designer.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, itemId } = await params;
  if (!(await canAccessProject(projectId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateDriveItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.driveItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.projectId !== projectId) {
    return NextResponse.json({ error: "Drive item not found" }, { status: 404 });
  }

  const updated = await prisma.driveItem.update({
    where: { id: itemId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, itemId } = await params;
  if (!(await canAccessProject(projectId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.driveItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.projectId !== projectId) {
    return NextResponse.json({ error: "Drive item not found" }, { status: 404 });
  }

  await prisma.driveItem.delete({ where: { id: itemId } });
  return NextResponse.json({ message: "Deleted" });
}
