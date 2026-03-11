"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface RoomObject {
  id: string;
  name: string;
  status: string;
  comments: { id: string }[];
}

interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  objects: RoomObject[];
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  client?: { user: { name: string; email: string } } | null;
  rooms: Room[];
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  user: { name: string | null; image: string | null };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomDims, setRoomDims] = useState({ width: 5, height: 3, depth: 5 });
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editRoomData, setEditRoomData] = useState({ name: "", width: 5, height: 3, depth: 5 });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [hasMoreActivities, setHasMoreActivities] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setProject(data);
        setLoading(false);
      });
    fetch(`/api/projects/${params.id}/activities`)
      .then((res) => res.json())
      .then((data) => {
        setActivities(data.activities || []);
        setActivityCursor(data.nextCursor);
        setHasMoreActivities(!!data.nextCursor);
      })
      .catch(() => {});
  }, [params.id]);

  async function createRoom() {
    if (!newRoomName.trim()) return;

    const res = await fetch(`/api/projects/${params.id}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newRoomName,
        ...roomDims,
      }),
    });

    if (res.ok) {
      const room = await res.json();
      setProject((prev) =>
        prev ? { ...prev, rooms: [...prev.rooms, { ...room, objects: [] }] } : prev
      );
      setNewRoomName("");
      setShowNewRoom(false);
      toast("Room created", "success");
    } else {
      toast("Failed to create room", "error");
    }
  }

  async function updateProjectStatus(status: string) {
    const res = await fetch(`/api/projects/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setProject((prev) => prev ? { ...prev, status } : prev);
      toast(`Project marked as ${status.toLowerCase()}`, "success");
    } else {
      toast("Failed to update status", "error");
    }
  }

  async function updateRoom(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editRoomData),
    });

    if (res.ok) {
      const updated = await res.json();
      setProject((prev) =>
        prev
          ? {
              ...prev,
              rooms: prev.rooms.map((r) =>
                r.id === roomId ? { ...r, ...updated } : r
              ),
            }
          : prev
      );
      setEditingRoom(null);
      toast("Room updated", "success");
    } else {
      toast("Failed to update room", "error");
    }
  }

  async function deleteRoom(roomId: string) {
    if (!confirm("Delete this room and all its objects?")) return;

    const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
    if (res.ok) {
      setProject((prev) =>
        prev ? { ...prev, rooms: prev.rooms.filter((r) => r.id !== roomId) } : prev
      );
      toast("Room deleted", "success");
    } else {
      toast("Failed to delete room", "error");
    }
  }

  async function deleteProject() {
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;

    const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Project deleted", "success");
      router.push("/dashboard/projects");
    } else {
      toast("Failed to delete project", "error");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 skeleton" />
        <div className="h-4 w-48 skeleton" />
        <div className="grid gap-4 sm:grid-cols-2 mt-8">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  const clientPortalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/portal/${project.id}`
    : "";

  const totalObjects = project.rooms.reduce((sum, r) => sum + r.objects.length, 0);
  const finalized = project.rooms.reduce(
    (sum, r) => sum + r.objects.filter((o) => o.status === "FINALIZED").length,
    0
  );
  const progress = totalObjects > 0 ? Math.round((finalized / totalObjects) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/projects"
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ← Projects
            </Link>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold">{project.title}</h1>
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
          {project.description && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {project.description}
            </p>
          )}
          {project.client && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Client: {project.client.user.name} ({project.client.user.email})
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* Status actions */}
          <select
            value={project.status}
            onChange={(e) => updateProjectStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--background)]"
          >
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button
            onClick={() => {
              navigator.clipboard.writeText(clientPortalUrl);
              toast("Client portal link copied!", "success");
            }}
            className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] hover:bg-[var(--secondary)] transition"
          >
            📋 Copy Client Link
          </button>
          <button
            onClick={deleteProject}
            className="px-3 py-1.5 rounded-lg text-xs text-[var(--destructive)] border border-[var(--destructive)] hover:bg-red-50 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)]">Rooms</p>
          <p className="text-2xl font-bold">{project.rooms.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)]">Objects</p>
          <p className="text-2xl font-bold">{totalObjects}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)]">Finalized</p>
          <p className="text-2xl font-bold">{finalized}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)]">Progress</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 rounded-full bg-[var(--secondary)]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-bold">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Client Portal Link */}
      {clientPortalUrl && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--secondary)] text-sm">
          <p className="font-medium mb-1">Client Portal Link</p>
          <code className="text-xs text-[var(--muted-foreground)] break-all">
            {clientPortalUrl}
          </code>
        </div>
      )}

      {/* Rooms */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Rooms</h2>
          <button
            onClick={() => setShowNewRoom(!showNewRoom)}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            + Add Room
          </button>
        </div>

        {showNewRoom && (
          <div className="p-4 rounded-xl border border-[var(--border)] mb-4 space-y-3">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Room name (e.g., Living Room)"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Width (m)</label>
                <input
                  type="number"
                  value={roomDims.width}
                  onChange={(e) => setRoomDims({ ...roomDims, width: +e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Height (m)</label>
                <input
                  type="number"
                  value={roomDims.height}
                  onChange={(e) => setRoomDims({ ...roomDims, height: +e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Depth (m)</label>
                <input
                  type="number"
                  value={roomDims.depth}
                  onChange={(e) => setRoomDims({ ...roomDims, depth: +e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createRoom}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 rounded-lg text-sm"
              >
                Create Room
              </button>
              <button
                onClick={() => setShowNewRoom(false)}
                className="px-4 py-1.5 rounded-lg text-sm border border-[var(--border)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {project.rooms.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-[var(--border)]">
            <p className="text-4xl mb-3">🏠</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              No rooms yet. Add your first room to start designing.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {project.rooms.map((room) =>
              editingRoom === room.id ? (
                <div
                  key={room.id}
                  className="p-5 rounded-xl border border-[var(--primary)] space-y-3"
                >
                  <input
                    value={editRoomData.name}
                    onChange={(e) =>
                      setEditRoomData({ ...editRoomData, name: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm font-semibold"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)]">W</label>
                      <input
                        type="number"
                        value={editRoomData.width}
                        onChange={(e) =>
                          setEditRoomData({ ...editRoomData, width: +e.target.value })
                        }
                        className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)]">H</label>
                      <input
                        type="number"
                        value={editRoomData.height}
                        onChange={(e) =>
                          setEditRoomData({ ...editRoomData, height: +e.target.value })
                        }
                        className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)]">D</label>
                      <input
                        type="number"
                        value={editRoomData.depth}
                        onChange={(e) =>
                          setEditRoomData({ ...editRoomData, depth: +e.target.value })
                        }
                        className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateRoom(room.id)}
                      className="bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1 rounded text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRoom(null)}
                      className="px-3 py-1 rounded text-xs border border-[var(--border)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={room.id}
                  className="p-5 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition group"
                >
                  <div className="flex items-start justify-between">
                    <Link href={`/dashboard/projects/${project.id}/rooms/${room.id}`}>
                      <h3 className="font-semibold hover:text-[var(--primary)]">
                        {room.name}
                      </h3>
                    </Link>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setEditingRoom(room.id);
                          setEditRoomData({
                            name: room.name,
                            width: room.width,
                            height: room.height,
                            depth: room.depth,
                          });
                        }}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-1"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          deleteRoom(room.id);
                        }}
                        className="text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] px-1"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {room.width}m × {room.depth}m × {room.height}m
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {room.objects.length} object(s)
                    </span>
                    {room.objects.filter((o) => o.status === "FINALIZED").length > 0 && (
                      <span className="status-badge status-finalized">
                        {room.objects.filter((o) => o.status === "FINALIZED").length} finalized
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/projects/${project.id}/rooms/${room.id}`}
                    className="mt-3 inline-block text-xs text-[var(--primary)] hover:underline"
                  >
                    Open 3D Builder →
                  </Link>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      {activities.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Activity</h2>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex gap-3 items-start text-sm"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--secondary)] flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  {activityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p>
                    <span className="font-medium">{activity.user.name || "System"}</span>{" "}
                    <span className="text-[var(--muted-foreground)]">{activity.message}</span>
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {hasMoreActivities && (
            <button
              onClick={async () => {
                const res = await fetch(
                  `/api/projects/${params.id}/activities?cursor=${activityCursor}`
                );
                const data = await res.json();
                setActivities((prev) => [...prev, ...(data.activities || [])]);
                setActivityCursor(data.nextCursor);
                setHasMoreActivities(!!data.nextCursor);
              }}
              className="mt-4 text-sm text-[var(--primary)] hover:underline"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function activityIcon(type: string): string {
  switch (type) {
    case "PROJECT_CREATED": return "🆕";
    case "PROJECT_UPDATED": return "📝";
    case "PROJECT_ARCHIVED": return "📦";
    case "ROOM_CREATED": return "🏠";
    case "ROOM_UPDATED": return "✏️";
    case "ROOM_DELETED": return "🗑️";
    case "OBJECT_ADDED": return "📐";
    case "OBJECT_UPDATED": return "🔧";
    case "OBJECT_DELETED": return "❌";
    case "OBJECT_APPROVED": return "✅";
    case "OBJECT_REJECTED": return "⛔";
    case "COMMENT_ADDED": return "💬";
    case "CLIENT_INVITED": return "👤";
    case "STATUS_CHANGED": return "🔄";
    default: return "📌";
  }
}
