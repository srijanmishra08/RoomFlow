import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTaskSchema } from "@/lib/validations";

async function verifyOwnership(projectId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return false;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return !!project && project.designerId === designer.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, taskId } = await params;
  if (!(await verifyOwnership(projectId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const task = await prisma.projectTask.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updated = await prisma.projectTask.update({
    where: { id: taskId },
    data: {
      ...parsed.data,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      completedAt:
        parsed.data.status === "COMPLETED"
          ? new Date()
          : parsed.data.status && parsed.data.status !== "COMPLETED"
          ? null
          : undefined,
    },
    include: {
      room: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, taskId } = await params;
  if (!(await verifyOwnership(projectId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await prisma.projectTask.findUnique({ where: { id: taskId } });
  if (!task || task.projectId !== projectId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.projectTask.delete({ where: { id: taskId } });
  return NextResponse.json({ message: "Deleted" });
}
