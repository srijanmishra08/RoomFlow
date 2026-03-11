"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ClientOption {
  id: string;
  user: { name: string; email: string };
}

export default function NewProjectPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then(setClients)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      clientId: (formData.get("clientId") as string) || undefined,
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to create project");
        return;
      }

      const project = await res.json();
      router.push(`/dashboard/projects/${project.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            {typeof error === "string" ? error : "Validation error"}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Project Title
          </label>
          <input
            name="title"
            type="text"
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="e.g., Modern Living Room Redesign"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Description (optional)
          </label>
          <textarea
            name="description"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
            placeholder="Brief description of the project"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Assign Client (optional)
          </label>
          <select
            name="clientId"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="">No client assigned</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.user.name} ({client.user.email})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--secondary)] transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
