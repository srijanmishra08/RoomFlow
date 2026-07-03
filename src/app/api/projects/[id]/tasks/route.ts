import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaskSchema } from "@/lib/validations";
import { PHASE_TASKS } from "@/lib/workflow";

async function getOwnedProject(projectId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.designerId !== designer.id) return null;
  return project;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await getOwnedProject(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
  }

  const scope = req.nextUrl.searchParams.get("scope");
  const roomId = req.nextUrl.searchParams.get("roomId");

  const tasks = await prisma.projectTask.findMany({
    where: {
      projectId,
      ...(scope ? { scope: scope as "PROJECT" | "ROOM" | "PHASE" } : {}),
      ...(roomId ? { roomId } : {}),
    },
    include: {
      room: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    tasks,
    phaseCatalog: PHASE_TASKS,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await getOwnedProject(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
  }

  const body = await req.json();

  if (body.bootstrap === true) {
    const existingPhaseTasks = await prisma.projectTask.count({
      where: { projectId, scope: "PHASE" },
    });

    if (existingPhaseTasks > 0) {
      return NextResponse.json({ error: "Phase tasks already exist" }, { status: 409 });
    }

    await prisma.projectTask.createMany({
      data: PHASE_TASKS.map((phase) => ({
        projectId,
        scope: "PHASE",
        phase,
        title: phase,
        status: "NOT_STARTED",
        progress: 0,
      })),
    });

    return NextResponse.json({ message: "Phase task board initialized" }, { status: 201 });
  }

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const task = await prisma.projectTask.create({
    data: {
      ...parsed.data,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      projectId,
      completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
    },
    include: {
      room: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
