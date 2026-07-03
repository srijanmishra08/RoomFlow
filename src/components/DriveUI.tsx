"use client";

import { useMemo, useState } from "react";

interface DriveItem {
  id: string;
  parentId: string | null;
  type: "FOLDER" | "FILE" | "LINK";
  name: string;
  phase: string | null;
  tags: string[];
  url: string | null;
  externalUrl: string | null;
  is3D: boolean;
  children?: DriveItem[];
}

interface DriveUIProps {
  projectId: string;
  initialTree: DriveItem[];
}

export function DriveUI({ projectId, initialTree }: DriveUIProps) {
  const [tree, setTree] = useState<DriveItem[]>(initialTree);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const flatFolders = useMemo(() => {
    const out: DriveItem[] = [];
    const walk = (items: DriveItem[]) => {
      for (const item of items) {
        if (item.type === "FOLDER") out.push(item);
        if (item.children?.length) walk(item.children);
      }
    };
    walk(tree);
    return out;
  }, [tree]);

  async function refresh() {
    const res = await fetch(`/api/projects/${projectId}/drive`);
    if (!res.ok) return;
    const payload = await res.json();
    setTree(payload.tree || []);
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/drive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newFolderName.trim(),
        type: "FOLDER",
        parentId: activeFolderId,
      }),
    });
    if (!res.ok) return;
    setNewFolderName("");
    await refresh();
  }

  async function createLink() {
    if (!linkName.trim() || !linkUrl.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/drive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: linkName.trim(),
        type: "LINK",
        parentId: activeFolderId,
        externalUrl: linkUrl.trim(),
      }),
    });
    if (!res.ok) return;
    setLinkName("");
    setLinkUrl("");
    await refresh();
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    if (activeFolderId) fd.append("parentId", activeFolderId);
    setUploading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/drive`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) await refresh();
    } finally {
      setUploading(false);
    }
  }

  function renderTree(items: DriveItem[], depth = 0): React.ReactNode {
    return items.map((item) => {
      const isActive = activeFolderId === item.id;
      const indent = { paddingLeft: `${depth * 12 + 8}px` };

      return (
        <div key={item.id}>
          <button
            type="button"
            style={indent}
            className={`w-full text-left py-1.5 rounded-md text-sm transition ${
              isActive ? "bg-[var(--secondary)]" : "hover:bg-[var(--secondary)]"
            }`}
            onClick={() => {
              if (item.type === "FOLDER") setActiveFolderId(item.id);
              if (item.type === "FILE" && item.url) window.open(item.url, "_blank");
              if (item.type === "LINK" && item.externalUrl) window.open(item.externalUrl, "_blank");
            }}
          >
            {item.type === "FOLDER" ? "📁" : item.type === "FILE" ? (item.is3D ? "🧊" : "📄") : "🔗"} {item.name}
          </button>
          {item.children?.length ? renderTree(item.children, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-xl border border-[var(--border)] p-3 max-h-[70vh] overflow-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Project Drive</h3>
          <button
            onClick={refresh}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Refresh
          </button>
        </div>
        {tree.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">No files yet.</p> : renderTree(tree)}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--muted-foreground)] mb-2">Active folder</p>
          <select
            className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
            value={activeFolderId || ""}
            onChange={(e) => setActiveFolderId(e.target.value || null)}
          >
            <option value="">Root</option>
            {flatFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
          <h4 className="text-sm font-medium">Create folder</h4>
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
          />
          <button onClick={createFolder} className="w-full px-3 py-1.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-sm">Create</button>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
          <h4 className="text-sm font-medium">Add external link</h4>
          <input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Link label"
            className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
          />
          <button onClick={createLink} className="w-full px-3 py-1.5 rounded border border-[var(--border)] text-sm">Save link</button>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
          <h4 className="text-sm font-medium">Upload file</h4>
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
            }}
            className="w-full text-xs"
          />
          {uploading ? <p className="text-xs text-[var(--muted-foreground)]">Uploading...</p> : null}
        </div>
      </div>
    </div>
  );
}
