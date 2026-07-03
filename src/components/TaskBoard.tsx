"use client";

import { useMemo, useState } from "react";

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

type Task = {
  id: string;
  title: string;
  scope: "PROJECT" | "ROOM" | "PHASE";
  phase: string | null;
  status: TaskStatus;
  progress: number;
  dueDate: string | null;
  room: { id: string; name: string } | null;
};

interface TaskBoardProps {
  projectId: string;
  initialTasks: Task[];
  phases: readonly string[];
  rooms: Array<{ id: string; name: string }>;
}

const STATUS_COLUMNS: Array<{ key: TaskStatus; label: string }> = [
  { key: "NOT_STARTED", label: "Not Started" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "COMPLETED", label: "Completed" },
];

export function TaskBoard({ projectId, initialTasks, phases, rooms }: TaskBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<"PROJECT" | "ROOM" | "PHASE">("PROJECT");
  const [phase, setPhase] = useState("");
  const [roomId, setRoomId] = useState("");

  const progressSummary = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length);
  }, [tasks]);

  async function createTask() {
    if (!title.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        scope,
        phase: scope === "PHASE" ? phase || null : null,
        roomId: scope === "ROOM" ? roomId || null : null,
      }),
    });

    if (!res.ok) return;
    const task = await res.json();
    setTasks((prev) => [task, ...prev]);
    setTitle("");
  }

  async function updateTask(taskId: string, patch: Partial<Task>) {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Project Task Board</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Overall progress: {progressSummary}%</p>
        </div>
        <button
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm"
          onClick={async () => {
            const res = await fetch(`/api/projects/${projectId}/tasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bootstrap: true }),
            });
            if (res.ok) {
              const fresh = await fetch(`/api/projects/${projectId}/tasks`).then((r) => r.json());
              setTasks(fresh.tasks || []);
            }
          }}
        >
          Initialize Phase Tasks
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
        <h3 className="text-sm font-medium">Add Task</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
          />
          <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="PROJECT">Project</option>
            <option value="ROOM">Room</option>
            <option value="PHASE">Phase</option>
          </select>
          <select value={phase} onChange={(e) => setPhase(e.target.value)} disabled={scope !== "PHASE"} className="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="">Select phase</option>
            {phases.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={scope !== "ROOM"} className="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm">
            <option value="">Select room</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={createTask} className="px-3 py-1.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-sm">Add</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((column) => (
          <div key={column.key} className="rounded-xl border border-[var(--border)] p-3">
            <h4 className="font-medium text-sm mb-3">{column.label}</h4>
            <div className="space-y-2">
              {tasks.filter((task) => task.status === column.key).map((task) => (
                <div key={task.id} className="p-2 rounded border border-[var(--border)] bg-[var(--background)]">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {task.scope}{task.phase ? ` · ${task.phase}` : ""}{task.room ? ` · ${task.room.name}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={task.progress}
                      onChange={(e) => updateTask(task.id, { progress: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs w-9 text-right">{task.progress}%</span>
                  </div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {STATUS_COLUMNS.map((statusOpt) => (
                      <button
                        key={statusOpt.key}
                        onClick={() => updateTask(task.id, { status: statusOpt.key })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${task.status === statusOpt.key ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}
                      >
                        {statusOpt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
