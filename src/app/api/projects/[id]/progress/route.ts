import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verifyProject(projectId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.designerId !== designer.id) return null;
  return project;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await verifyProject(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
  }

  const [rooms, tasks] = await Promise.all([
    prisma.room.findMany({
      where: { projectId },
      include: {
        tasks: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.projectTask.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const roomProgress = rooms.map((room) => {
    const taskProgress = room.tasks.length > 0 ? average(room.tasks.map((task) => task.progress)) : 0;
    return {
      roomId: room.id,
      roomName: room.name,
      progress: taskProgress,
      totalTasks: room.tasks.length,
      completedTasks: room.tasks.filter((task) => task.status === "COMPLETED").length,
    };
  });

  const phaseMap = new Map<string, { progress: number[]; total: number; completed: number }>();
  for (const task of tasks.filter((task) => task.scope === "PHASE")) {
    const phaseName = task.phase || task.title;
    const current = phaseMap.get(phaseName) || { progress: [], total: 0, completed: 0 };
    current.progress.push(task.progress);
    current.total += 1;
    if (task.status === "COMPLETED") current.completed += 1;
    phaseMap.set(phaseName, current);
  }

  const phaseProgress = Array.from(phaseMap.entries()).map(([phase, value]) => ({
    phase,
    progress: average(value.progress),
    totalTasks: value.total,
    completedTasks: value.completed,
  }));

  const allTaskProgress = tasks.map((task) => task.progress);

  return NextResponse.json({
    projectId,
    projectProgress: average(allTaskProgress),
    roomProgress,
    phaseProgress,
    timeline: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      phase: task.phase,
      scope: task.scope,
      status: task.status,
      progress: task.progress,
      dueDate: task.dueDate,
      updatedAt: task.updatedAt,
    })),
  });
}
