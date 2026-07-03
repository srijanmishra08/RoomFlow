import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TimelinePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const designer = await prisma.designer.findUnique({ where: { userId: session.user.id } });
  if (!designer) return <div>Designer profile not found.</div>;

  const project = await prisma.project.findFirst({
    where: { designerId: designer.id },
    orderBy: { updatedAt: "desc" },
    include: {
      tasks: {
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!project) {
    return <div className="text-sm text-[var(--muted-foreground)]">No timeline yet. Create a project first.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          End-to-end project pulse with task deadlines and activity history.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="font-semibold mb-3">Upcoming / Active Tasks</h2>
        <div className="space-y-2">
          {project.tasks.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No tasks yet.</p>
          ) : (
            project.tasks.map((task) => (
              <div key={task.id} className="p-3 rounded-lg border border-[var(--border)] flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {task.scope}{task.phase ? ` · ${task.phase}` : ""}
                    {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString("en-IN")}` : ""}
                  </p>
                </div>
                <div className="w-28">
                  <div className="h-2 rounded-full bg-[var(--secondary)]">
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${task.progress}%` }} />
                  </div>
                  <p className="text-[10px] text-right mt-1 text-[var(--muted-foreground)]">{task.progress}%</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4">
        <h2 className="font-semibold mb-3">Activity Feed</h2>
        <div className="space-y-2">
          {project.activities.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No recent activity.</p>
          ) : (
            project.activities.map((activity) => (
              <div key={activity.id} className="text-sm border-l-2 border-[var(--border)] pl-3 py-1">
                <p>{activity.message}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{new Date(activity.createdAt).toLocaleString("en-IN")}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
