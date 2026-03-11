"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface Client {
  id: string;
  phone: string | null;
  user: { name: string; email: string };
  projects: { id: string; title: string; status: string }[];
}

export default function ClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.user.name.toLowerCase().includes(q) ||
        c.user.email.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [clients, search]);

  async function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setFormError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setFormError(body.error || "Failed to create client");
        return;
      }

      const newClient = await res.json();
      if (newClient.tempPassword) {
        toast(`Client created! Temp password: ${newClient.tempPassword}`, "success");
      } else {
        toast("Client added successfully", "success");
      }

      // Refresh
      const refreshRes = await fetch("/api/clients");
      const refreshed = await refreshRes.json();
      setClients(refreshed);
      setShowForm(false);
    } catch {
      setFormError("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton" />
        <div className="h-4 w-32 skeleton" />
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your client relationships
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          + Add Client
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        />
      </div>

      {showForm && (
        <div className="p-5 rounded-xl border border-[var(--border)] mb-6">
          <h3 className="font-semibold mb-4">New Client</h3>
          <form onSubmit={handleCreateClient} className="space-y-3">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                {typeof formError === "string" ? formError : "Validation error"}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  name="name"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="client@email.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone (optional)
                </label>
                <input
                  name="phone"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="+91..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Address (optional)
                </label>
                <input
                  name="address"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="Client address"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 rounded-lg text-sm disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Client"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-1.5 rounded-lg text-sm border border-[var(--border)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)]">
          <p className="text-4xl mb-4">👥</p>
          <p className="font-semibold">No clients yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Add your first client to start collaborating
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">No clients match your search</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="p-5 rounded-xl border border-[var(--border)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{client.user.name}</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {client.user.email}
                    {client.phone && ` · ${client.phone}`}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {client.projects.length} project(s)
                </span>
              </div>
              {client.projects.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {client.projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/projects/${p.id}`}
                      className="text-xs px-2 py-1 rounded-md bg-[var(--secondary)] hover:bg-[var(--accent)] transition"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
