"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderOpen,
  HardDrive,
  CheckSquare,
  CalendarClock,
  Users,
  Palette,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
} from "@/components/icons";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
  { href: "/dashboard/drive", label: "Drive", icon: HardDrive },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/timeline", label: "Timeline", icon: CalendarClock },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/assets", label: "Asset Library", icon: Palette },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Room<span className="text-[var(--primary)]">Flow</span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--primary)]" />
              )}
              <Icon size={20} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Account */}
      <div className="px-4 py-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-xs font-bold shrink-0">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-[var(--muted-foreground)] truncate">
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-3 flex items-center gap-2 w-full text-left text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] border-r border-[var(--border)] bg-[var(--background)] flex flex-col z-50 md:hidden transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] border-r border-[var(--border)] bg-[var(--background)] flex-col z-40 hidden md:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
