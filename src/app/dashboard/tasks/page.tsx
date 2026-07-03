import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskBoard } from "@/components/TaskBoard";
import { PHASE_TASKS } from "@/lib/workflow";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const designer = await prisma.designer.findUnique({ where: { userId: session.user.id } });
  if (!designer) return <div>Designer profile not found.</div>;

  const project = await prisma.project.findFirst({
    where: { designerId: designer.id },
    orderBy: { updatedAt: "desc" },
    include: {
      rooms: { select: { id: true, name: true } },
      tasks: {
        include: {
          room: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    return <div className="text-sm text-[var(--muted-foreground)]">Create a project first to manage tasks.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Track project, room, and phase tasks with progress and status flows.
        </p>
      </div>
      <div className="p-3 rounded-xl border border-[var(--border)] text-sm">
        Active project: <span className="font-medium">{project.title}</span>
      </div>
      <TaskBoard
        projectId={project.id}
        initialTasks={project.tasks as any}
        phases={PHASE_TASKS}
        rooms={project.rooms}
      />
    </div>
  );
}
