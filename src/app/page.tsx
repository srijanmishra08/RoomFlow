import Link from "next/link";
import {
  Building,
  Users,
  LayoutDashboard,
  CheckSquare,
  Palette,
  Sparkles,
} from "@/components/icons";

const features = [
  {
    icon: Building,
    title: "3D Room Builder",
    description:
      "Create rooms with dimensions, add furniture, apply materials, and design in full 3D.",
  },
  {
    icon: Users,
    title: "Client Portal",
    description:
      "Share interactive 3D views with clients. They can explore, comment, and approve designs.",
  },
  {
    icon: LayoutDashboard,
    title: "Progress Tracking",
    description:
      "Track every element — planned, in progress, or finalized — with visual status indicators.",
  },
  {
    icon: CheckSquare,
    title: "Approval Workflow",
    description:
      "Clients can approve, reject, or request changes on individual items with notes.",
  },
  {
    icon: Palette,
    title: "Asset Library",
    description:
      "Upload 3D models, organize by category, and reuse across projects instantly.",
  },
  {
    icon: Sparkles,
    title: "Works Everywhere",
    description:
      "Fully responsive dashboard and client portal that works on desktop, tablet, and mobile.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Room<span className="text-[var(--primary)]">Flow</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
            Interactive 3D rooms
            <br />
            <span className="text-[var(--primary)]">for your clients</span>
          </h1>
          <p className="mt-6 text-lg text-[var(--muted-foreground)] max-w-xl mx-auto">
            Build stunning 3D room models, share interactive client portals, and
            track design progress — all in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              Start Free Trial
            </Link>
            <Link
              href="#features"
              className="border border-[var(--border)] px-6 py-3 rounded-lg text-sm font-medium hover:bg-[var(--secondary)] transition"
            >
              See Features
            </Link>
          </div>

          {/* Feature cards */}
          <div
            id="features"
            className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-xl border border-[var(--border)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-4">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted-foreground)]">
        © 2026 RoomFlow. Built for interior designers.
      </footer>
    </div>
  );
}
