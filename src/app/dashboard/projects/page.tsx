"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updatedAt: string;
  client?: { user: { name: string; email: string } } | null;
  rooms: { id: string; name: string }[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.client?.user.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, search, statusFilter]);

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
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your design projects
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          + New Project
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects or clients..."
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)]">
          <p className="text-4xl mb-4">📁</p>
          <p className="font-semibold">No projects yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create your first project to get started
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">No projects match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="p-5 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{project.title}</h3>
                  {project.description && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted-foreground)]">
                    {project.client && (
                      <span>Client: {project.client.user.name}</span>
                    )}
                    <span>{project.rooms.length} room(s)</span>
                    <span>
                      Updated{" "}
                      {new Date(project.updatedAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
