import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar user={session.user} />
      <main className="flex-1 md:ml-[var(--sidebar-width)]">
        <div className="p-4 md:p-6 max-w-7xl mx-auto pt-16 md:pt-6">{children}</div>
      </main>
    </div>
  );
}
