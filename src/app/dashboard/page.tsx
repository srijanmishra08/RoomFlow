import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { FolderOpen, Users, Palette, CreditCard } from "@/components/icons";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
    include: {
      projects: {
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      },
      clients: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
      _count: {
        select: { projects: true, clients: true, assets: true },
      },
    },
  });

  if (!designer) return <div>Designer profile not found.</div>;

  // Billing summary
  const invoices = await prisma.invoice.findMany({
    where: { designerId: designer.id },
    select: { total: true, status: true },
  });
  const totalBilled = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter((i) => ["DRAFT", "SENT", "OVERDUE"].includes(i.status)).reduce((s, i) => s + i.total, 0);

  function formatINR(amount: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  }

  const stats = [
    { label: "Projects", value: String(designer._count.projects), icon: FolderOpen },
    { label: "Clients", value: String(designer._count.clients), icon: Users },
    { label: "Assets", value: String(designer._count.assets), icon: Palette },
    { label: "Billed", value: formatINR(totalBilled), icon: CreditCard },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back, {session.user.name}
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          {designer.studioName
            ? `${designer.studioName} dashboard`
            : "Your design dashboard"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-5 rounded-xl border border-[var(--border)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Billing Overview */}
      <div className="rounded-xl border border-[var(--border)] mb-8">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold">Billing Overview</h2>
          <Link
            href="/dashboard/billing"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Manage invoices →
          </Link>
        </div>
        <div className="p-5 grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Total Billed</p>
            <p className="text-xl font-bold mt-1">{formatINR(totalBilled)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Paid</p>
            <p className="text-xl font-bold mt-1 text-emerald-600">{formatINR(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Pending</p>
            <p className="text-xl font-bold mt-1 text-amber-600">{formatINR(totalPending)}</p>
          </div>
        </div>
        {invoices.length === 0 && (
          <div className="px-5 pb-5">
            <Link
              href="/dashboard/billing"
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Create your first invoice →
            </Link>
          </div>
        )}
      </div>

      {/* Recent Projects */}
      <div className="rounded-xl border border-[var(--border)]">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold">Recent Projects</h2>
          <Link
            href="/dashboard/projects"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            View all
          </Link>
        </div>
        {designer.projects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--muted-foreground)] text-sm">
              No projects yet.
            </p>
            <Link
              href="/dashboard/projects/new"
              className="inline-block mt-3 text-sm text-[var(--primary)] hover:underline"
            >
              Create your first project →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {designer.projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-[var(--secondary)] transition"
              >
                <div>
                  <p className="text-sm font-medium">{project.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Updated{" "}
                    {new Date(project.updatedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <span
                  className={`status-badge ${
                    project.status === "ACTIVE"
                      ? "status-in-progress"
                      : project.status === "COMPLETED"
                      ? "status-finalized"
                      : "status-planned"
                  }`}
                >
                  {project.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
