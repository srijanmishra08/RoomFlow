"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ObjectInspector } from "@/components/three/ObjectInspector";
import type { RoomObjectData } from "@/components/three/RoomViewer";
import Link from "next/link";
import { useToast } from "@/components/Toast";

// Dynamic import for Three.js (no SSR)
const RoomViewer = dynamic(
  () => import("@/components/three/RoomViewer").then((mod) => mod.RoomViewer),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">Loading 3D viewer...</div> }
);

interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  projectId: string;
}

interface Asset {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  category: string | null;
}

export default function RoomBuilderPage() {
  const params = useParams();
  const { toast } = useToast();
  const projectId = params.id as string;
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [objects, setObjects] = useState<RoomObjectData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [selectedAssetUrl, setSelectedAssetUrl] = useState("");

  const selectedObject = objects.find((o) => o.id === selectedId) || null;

  useEffect(() => {
    async function load() {
      const [projRes, assetsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch("/api/assets"),
      ]);
      const proj = await projRes.json();
      const roomData = proj.rooms?.find((r: Room) => r.id === roomId);

      if (roomData) {
        setRoom({
          id: roomData.id,
          name: roomData.name,
          width: roomData.width,
          height: roomData.height,
          depth: roomData.depth,
          projectId,
        });
        setObjects(roomData.objects || []);
      }

      if (assetsRes.ok) {
        setAssets(await assetsRes.json());
      }
      setLoading(false);
    }
    load();
  }, [projectId, roomId]);

  const addObject = useCallback(
    async (formData: FormData) => {
      const data = {
        name: formData.get("name") as string,
        modelUrl: (formData.get("modelUrl") as string) || null,
        positionX: parseFloat(formData.get("positionX") as string) || 0,
        positionY: parseFloat(formData.get("positionY") as string) || 0,
        positionZ: parseFloat(formData.get("positionZ") as string) || 0,
        status: (formData.get("status") as string) || "PLANNED",
        material: (formData.get("material") as string) || null,
        brand: (formData.get("brand") as string) || null,
        cost: formData.get("cost") ? parseFloat(formData.get("cost") as string) : null,
      };

      const res = await fetch(`/api/rooms/${roomId}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const obj = await res.json();
        setObjects((prev) => [...prev, { ...obj, comments: [] }]);
        setShowAddForm(false);
        setSelectedAssetUrl("");
        toast("Object added to room", "success");
      } else {
        toast("Failed to add object", "error");
      }
    },
    [roomId, toast]
  );

  const updateObject = useCallback(
    async (data: Partial<RoomObjectData>) => {
      if (!selectedId) return;

      const res = await fetch(`/api/objects/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const updated = await res.json();
        setObjects((prev) =>
          prev.map((o) => (o.id === selectedId ? { ...o, ...updated } : o))
        );
        toast("Object updated", "success");
      }
    },
    [selectedId, toast]
  );

  const deleteObject = useCallback(async () => {
    if (!selectedId) return;
    if (!confirm("Delete this object?")) return;

    const res = await fetch(`/api/objects/${selectedId}`, { method: "DELETE" });
    if (res.ok) {
      setObjects((prev) => prev.filter((o) => o.id !== selectedId));
      setSelectedId(null);
      toast("Object deleted", "success");
    }
  }, [selectedId, toast]);

  const addComment = useCallback(
    async (content: string) => {
      if (!selectedId) return;

      const res = await fetch(`/api/objects/${selectedId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const comment = await res.json();
        setObjects((prev) =>
          prev.map((o) =>
            o.id === selectedId
              ? { ...o, comments: [comment, ...(o.comments || [])] }
              : o
          )
        );
      }
    },
    [selectedId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)]">
        Loading room...
      </div>
    );
  }

  if (!room) {
    return <div>Room not found</div>;
  }

  return (
    <div className="h-[calc(100vh-48px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold">{room.name}</h1>
          <span className="text-xs text-[var(--muted-foreground)]">
            {room.width}m × {room.depth}m × {room.height}m
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 rounded-lg text-sm"
          >
            + Add Object
          </button>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] ml-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#9ca3af]" /> Planned
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#eab308]" /> In Progress
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Finalized
            </span>
          </div>
        </div>
      </div>

      {/* Add Object Form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-[var(--border)] mb-4">
          {/* Asset Picker */}
          {assets.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setShowAssetPicker(!showAssetPicker)}
                className="text-xs text-[var(--primary)] hover:underline mb-2"
              >
                {showAssetPicker ? "Hide" : "Pick from"} Asset Library ({assets.length})
              </button>
              {showAssetPicker && (
                <div className="flex gap-2 flex-wrap mb-3 p-3 rounded-lg bg-[var(--secondary)] max-h-32 overflow-y-auto">
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => {
                        setSelectedAssetUrl(asset.fileUrl);
                        setShowAssetPicker(false);
                      }}
                      className={`text-xs px-2 py-1 rounded border transition ${
                        selectedAssetUrl === asset.fileUrl
                          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border-[var(--border)] hover:border-[var(--primary)]"
                      }`}
                    >
                      📦 {asset.name}
                      {asset.category && <span className="text-[10px] ml-1 opacity-70">({asset.category})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addObject(new FormData(e.currentTarget));
            }}
            className="grid grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Name *</label>
              <input name="name" required className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" placeholder="e.g., Sofa" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Model URL (GLTF)</label>
              <input
                name="modelUrl"
                type="url"
                value={selectedAssetUrl}
                onChange={(e) => setSelectedAssetUrl(e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
                placeholder="https://... or pick from library"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Status</label>
              <select name="status" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1">
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="FINALIZED">Finalized</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 rounded text-sm">Add</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 rounded text-sm border border-[var(--border)]">Cancel</button>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">X Position</label>
              <input name="positionX" type="number" step="0.1" defaultValue="0" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Y Position</label>
              <input name="positionY" type="number" step="0.1" defaultValue="0" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Z Position</label>
              <input name="positionZ" type="number" step="0.1" defaultValue="0" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Brand</label>
                <input name="brand" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Cost</label>
                <input name="cost" type="number" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" />
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 3D Viewer + Inspector */}
      <div className="flex gap-4 h-[calc(100%-120px)]">
        <div className="flex-1">
          <RoomViewer
            width={room.width}
            height={room.height}
            depth={room.depth}
            objects={objects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isEditable={true}
          />
        </div>

        {/* Side panel */}
        <div className="w-80 shrink-0">
          {selectedObject ? (
            <ObjectInspector
              object={selectedObject}
              isEditable={true}
              onUpdate={updateObject}
              onDelete={deleteObject}
              onComment={addComment}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 rounded-xl border border-[var(--border)]">
              <p className="text-3xl mb-3">🖱️</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Click an object in the 3D view to inspect it
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                {objects.length} object(s) in this room
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
