import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DriveUI } from "@/components/DriveUI";
import { PROJECT_DRIVE_ROOT_FOLDERS } from "@/lib/workflow";

export default async function DrivePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const designer = await prisma.designer.findUnique({ where: { userId: session.user.id } });
  if (!designer) return <div>Designer profile not found.</div>;

  const projects = await prisma.project.findMany({
    where: { designerId: designer.id },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });

  if (projects.length === 0) {
    return <div className="text-sm text-[var(--muted-foreground)]">Create a project first to use Drive.</div>;
  }

  const activeProjectId = projects[0].id;

  const existingRootFolders = await prisma.driveItem.findMany({
    where: { projectId: activeProjectId, parentId: null, type: "FOLDER" },
    select: { name: true },
  });
  const rootNameSet = new Set(existingRootFolders.map((folder) => folder.name));
  const missing = PROJECT_DRIVE_ROOT_FOLDERS.filter((folder) => !rootNameSet.has(folder));

  if (missing.length > 0) {
    await prisma.driveItem.createMany({
      data: missing.map((name) => ({
        projectId: activeProjectId,
        createdById: session.user.id,
        type: "FOLDER",
        name,
        phase: name,
        tags: [],
      })),
    });
  }

  const items = await prisma.driveItem.findMany({
    where: { projectId: activeProjectId },
    orderBy: { createdAt: "asc" },
  });

  function buildTree(parentId: string | null = null): any[] {
    return items
      .filter((item) => (item.parentId ?? null) === parentId)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "FOLDER" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((item) => ({ ...item, children: buildTree(item.id) }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Drive</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Upload all project artifacts, create folder structures, and attach external links.
        </p>
      </div>

      <div className="p-3 rounded-xl border border-[var(--border)] text-sm">
        Active project: <span className="font-medium">{projects[0].title}</span>
      </div>

      <DriveUI projectId={activeProjectId} initialTree={buildTree()} />
    </div>
  );
}
