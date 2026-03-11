import Link from "next/link";

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
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
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
            <div className="p-6 rounded-xl border border-[var(--border)]">
              <div className="text-2xl mb-3">🏠</div>
              <h3 className="font-semibold mb-1">3D Room Builder</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Create rooms with dimensions, add furniture, apply materials,
                and design in full 3D.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--border)]">
              <div className="text-2xl mb-3">👥</div>
              <h3 className="font-semibold mb-1">Client Portal</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Share interactive 3D views with clients. They can explore,
                comment, and approve designs.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--border)]">
              <div className="text-2xl mb-3">📊</div>
              <h3 className="font-semibold mb-1">Progress Tracking</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Track every element — planned, in progress, or finalized — with
                visual status indicators.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--border)]">
              <div className="text-2xl mb-3">✅</div>
              <h3 className="font-semibold mb-1">Approval Workflow</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Clients can approve, reject, or request changes on individual
                items with notes.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--border)]">
              <div className="text-2xl mb-3">🎨</div>
              <h3 className="font-semibold mb-1">Asset Library</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Upload 3D models, organize by category, and reuse across
                projects instantly.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--border)]">
              <div className="text-2xl mb-3">📱</div>
              <h3 className="font-semibold mb-1">Works Everywhere</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Fully responsive dashboard and client portal that works on
                desktop, tablet, and mobile.
              </p>
            </div>
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
