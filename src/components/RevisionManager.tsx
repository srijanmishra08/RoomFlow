"use client";

import { useMemo, useState } from "react";

type Revision = {
  id: string;
  version: number;
  label: string;
  type: string;
  status: string;
  sourceFileUrl: string;
  sceneUrl: string | null;
  createdAt: string;
};

interface RevisionManagerProps {
  roomId: string;
  revisions: Revision[];
  onSelect: (revisionId: string | null) => void;
  selectedRevisionId: string | null;
  onRefresh?: () => Promise<void>;
}

export function RevisionManager({ roomId, revisions, selectedRevisionId, onSelect, onRefresh }: RevisionManagerProps) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [compareResult, setCompareResult] = useState<any>(null);

  const readyRevisions = useMemo(() => revisions.filter((r) => r.status !== "FAILED"), [revisions]);

  async function compare() {
    if (!fromId || !toId) return;
    const res = await fetch(`/api/rooms/${roomId}/revisions/compare?from=${fromId}&to=${toId}`);
    if (!res.ok) return;
    setCompareResult(await res.json());
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Revision Manager</h3>
          {onRefresh ? (
            <button onClick={() => void onRefresh()} className="text-xs text-[var(--primary)] hover:underline">Refresh</button>
          ) : null}
        </div>
        <div className="space-y-2 max-h-44 overflow-auto">
          <button
            onClick={() => onSelect(null)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs border ${selectedRevisionId === null ? "border-[var(--primary)]" : "border-[var(--border)]"}`}
          >
            Live Room State
          </button>
          {revisions.map((revision) => (
            <button
              key={revision.id}
              onClick={() => onSelect(revision.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs border ${selectedRevisionId === revision.id ? "border-[var(--primary)]" : "border-[var(--border)]"}`}
              title={`Version ${revision.version}`}
            >
              <span className="font-medium">v{revision.version}</span> · {revision.label} · {revision.type}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
        <h4 className="text-sm font-medium">Compare revisions</h4>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-xs">
          <option value="">From revision</option>
          {readyRevisions.map((r) => <option key={r.id} value={r.id}>v{r.version} - {r.label}</option>)}
        </select>
        <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-xs">
          <option value="">To revision</option>
          {readyRevisions.map((r) => <option key={r.id} value={r.id}>v{r.version} - {r.label}</option>)}
        </select>
        <button onClick={compare} className="w-full px-2 py-1.5 rounded border border-[var(--border)] text-xs">Compare</button>
        {compareResult ? (
          <div className="text-xs text-[var(--muted-foreground)] rounded border border-[var(--border)] p-2">
            <p>Version delta: {compareResult.delta?.versionDelta ?? 0}</p>
            <p>Scene changed: {String(compareResult.delta?.changedScene)}</p>
            <p>Source changed: {String(compareResult.delta?.changedSource)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
