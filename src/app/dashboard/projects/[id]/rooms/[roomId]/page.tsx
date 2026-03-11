"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ObjectInspector } from "@/components/three/ObjectInspector";
import type { RoomObjectData } from "@/components/three/RoomViewer";
import type { SurfaceMaterial, FloorPoint } from "@/components/three/RoomBox";
import Link from "next/link";
import { useToast } from "@/components/Toast";

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
  floorPoints?: FloorPoint[] | null;
  modelUrl?: string | null;
  floorMaterial?: SurfaceMaterial | null;
  wallMaterial?: SurfaceMaterial | null;
  ceilingMaterial?: SurfaceMaterial | null;
}

interface Asset {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  category: string | null;
}

// Preset room shapes
const ROOM_PRESETS: { name: string; points: FloorPoint[] }[] = [
  { name: "Rectangle", points: [] },
  {
    name: "L-Shape",
    points: [
      { x: -3, z: -3 }, { x: 3, z: -3 }, { x: 3, z: 0 },
      { x: 1, z: 0 }, { x: 1, z: 3 }, { x: -3, z: 3 },
    ],
  },
  {
    name: "T-Shape",
    points: [
      { x: -1, z: -3 }, { x: 1, z: -3 }, { x: 1, z: -1 },
      { x: 3, z: -1 }, { x: 3, z: 1 }, { x: 1, z: 1 },
      { x: 1, z: 3 }, { x: -1, z: 3 }, { x: -1, z: 1 },
      { x: -3, z: 1 }, { x: -3, z: -1 }, { x: -1, z: -1 },
    ],
  },
  {
    name: "Pentagon",
    points: [
      { x: 0, z: -3 }, { x: 2.85, z: -0.93 }, { x: 1.76, z: 2.43 },
      { x: -1.76, z: 2.43 }, { x: -2.85, z: -0.93 },
    ],
  },
];

const SURFACE_COLORS = [
  "#e8e0d4", "#f5f0eb", "#d4c4b0", "#c9b99a", "#bfae94",
  "#f0e6d8", "#e6dcd0", "#d9cfc3", "#ccc2b6", "#bfb5a9",
  "#ffffff", "#f5f5f5", "#e8e8e8", "#d0d0d0", "#b8b8b8",
  "#e8d5c4", "#d4bfaa", "#c0a990", "#f5e6d8", "#ebe0d4",
  "#d4e8d4", "#c4d4c4", "#b4c4b4", "#e8e0c4", "#d4d0b0",
];

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SurfaceMaterial | null;
  onChange: (mat: SurfaceMaterial | null) => void;
}) {
  const current = value?.type === "color" ? value.value : null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      <div className="flex flex-wrap gap-1">
        {SURFACE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ type: "color", value: c })}
            className="w-5 h-5 rounded border transition-transform hover:scale-125"
            style={{
              backgroundColor: c,
              borderColor: current === c ? "var(--primary)" : "var(--border)",
              outline: current === c ? "2px solid var(--primary)" : "none",
              outlineOffset: "1px",
            }}
          />
        ))}
        <input
          type="color"
          value={current || "#e8e0d4"}
          onChange={(e) => onChange({ type: "color", value: e.target.value })}
          className="w-5 h-5 rounded border border-[var(--border)] cursor-pointer"
          title="Custom color"
        />
      </div>
    </div>
  );
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
  const [activePanel, setActivePanel] = useState<"inspector" | "materials" | "shape">("inspector");
  const [saving, setSaving] = useState(false);

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
          floorPoints: roomData.floorPoints,
          modelUrl: roomData.modelUrl,
          floorMaterial: roomData.floorMaterial,
          wallMaterial: roomData.wallMaterial,
          ceilingMaterial: roomData.ceilingMaterial,
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

  const saveRoom = useCallback(
    async (updates: Partial<Room>) => {
      setSaving(true);
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        toast("Failed to save room changes", "error");
      }
      setRoom((prev) => prev ? { ...prev, ...updates } : prev);
      setSaving(false);
    },
    [roomId, toast]
  );

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
        color: (formData.get("color") as string) || null,
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
        const err = await res.json().catch(() => ({}));
        toast(`Failed: ${err.error ? JSON.stringify(err.error) : "unknown error"}`, "error");
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
      <div className="flex items-center justify-between mb-3">
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
        <div className="p-4 rounded-xl border border-[var(--border)] mb-3 bg-[var(--card)]">
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
              <label className="text-xs text-[var(--muted-foreground)]">3D Model (GLB/GLTF)</label>
              <input
                name="modelUrl"
                value={selectedAssetUrl}
                onChange={(e) => setSelectedAssetUrl(e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
                placeholder="URL or pick from library"
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
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Object Color</label>
              <input name="color" type="color" defaultValue="#6366f1" className="w-full h-[34px] px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] mt-1 cursor-pointer" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Material</label>
                <input name="material" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" placeholder="e.g. Wood" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Brand</label>
                <input name="brand" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Cost</label>
              <input name="cost" type="number" className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1" />
            </div>
          </form>
        </div>
      )}

      {/* 3D Viewer + Side Panel */}
      <div className="flex gap-3 h-[calc(100%-100px)]">
        <div className="flex-1">
          <RoomViewer
            width={room.width}
            height={room.height}
            depth={room.depth}
            objects={objects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isEditable={true}
            floorPoints={room.floorPoints}
            roomModelUrl={room.modelUrl}
            floorMaterial={room.floorMaterial}
            wallMaterial={room.wallMaterial}
            ceilingMaterial={room.ceilingMaterial}
          />
        </div>

        {/* Side panel with tabs */}
        <div className="w-80 shrink-0 flex flex-col">
          <div className="flex border-b border-[var(--border)] mb-2">
            {(["inspector", "materials", "shape"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActivePanel(tab)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition capitalize ${
                  activePanel === tab
                    ? "border-[var(--primary)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activePanel === "inspector" && (
              <>
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
              </>
            )}

            {activePanel === "materials" && (
              <div className="space-y-4 p-3 rounded-xl border border-[var(--border)]">
                <h3 className="text-sm font-semibold">Room Materials</h3>

                <ColorPicker
                  label="Floor Color"
                  value={room.floorMaterial ?? null}
                  onChange={(mat) => {
                    setRoom((prev) => prev ? { ...prev, floorMaterial: mat } : prev);
                    saveRoom({ floorMaterial: mat } as Partial<Room>);
                  }}
                />
                <ColorPicker
                  label="Wall Color"
                  value={room.wallMaterial ?? null}
                  onChange={(mat) => {
                    setRoom((prev) => prev ? { ...prev, wallMaterial: mat } : prev);
                    saveRoom({ wallMaterial: mat } as Partial<Room>);
                  }}
                />
                <ColorPicker
                  label="Ceiling Color"
                  value={room.ceilingMaterial ?? null}
                  onChange={(mat) => {
                    setRoom((prev) => prev ? { ...prev, ceilingMaterial: mat } : prev);
                    saveRoom({ ceilingMaterial: mat } as Partial<Room>);
                  }}
                />

                <div className="pt-2 border-t border-[var(--border)]">
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">Room 3D File</label>
                  <p className="text-[10px] text-[var(--muted-foreground)] mb-1">
                    Upload a .glb/.gltf from Blender, SketchUp, or AutoCAD
                  </p>
                  <input
                    type="text"
                    value={room.modelUrl || ""}
                    onChange={(e) => {
                      const url = e.target.value || null;
                      setRoom((prev) => prev ? { ...prev, modelUrl: url } : prev);
                    }}
                    onBlur={(e) => {
                      saveRoom({ modelUrl: e.target.value || null } as Partial<Room>);
                    }}
                    className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-xs"
                    placeholder="URL to .glb or .gltf file"
                  />
                </div>
              </div>
            )}

            {activePanel === "shape" && (
              <div className="space-y-4 p-3 rounded-xl border border-[var(--border)]">
                <h3 className="text-sm font-semibold">Room Shape</h3>

                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)] mb-2 block">Preset Shapes</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROOM_PRESETS.map((preset) => {
                      const isActive = preset.points.length === 0
                        ? !room.floorPoints || room.floorPoints.length === 0
                        : JSON.stringify(room.floorPoints) === JSON.stringify(preset.points);
                      return (
                        <button
                          key={preset.name}
                          onClick={() => {
                            const pts = preset.points.length > 0 ? preset.points : null;
                            setRoom((prev) => prev ? { ...prev, floorPoints: pts } : prev);
                            saveRoom({ floorPoints: pts } as Partial<Room>);
                          }}
                          className={`px-3 py-2 rounded-lg text-xs border transition ${
                            isActive
                              ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "border-[var(--border)] hover:border-[var(--primary)]"
                          }`}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border)]">
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">Dimensions</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {([
                      { key: "width", label: "Width (m)", def: 5 },
                      { key: "depth", label: "Depth (m)", def: 5 },
                      { key: "height", label: "Height (m)", def: 3 },
                    ] as const).map(({ key, label, def }) => (
                      <div key={key}>
                        <label className="text-[10px] text-[var(--muted-foreground)]">{label}</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={room[key]}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || def;
                            setRoom((prev) => prev ? { ...prev, [key]: v } : prev);
                          }}
                          onBlur={(e) => {
                            saveRoom({ [key]: parseFloat(e.target.value) || def } as Partial<Room>);
                          }}
                          className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {room.floorPoints && room.floorPoints.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <label className="text-xs font-medium text-[var(--muted-foreground)]">
                      Floor Points ({room.floorPoints.length} vertices)
                    </label>
                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                      {room.floorPoints.map((pt, i) => (
                        <div key={i} className="flex gap-1 items-center text-[10px]">
                          <span className="text-[var(--muted-foreground)] w-4">{i + 1}.</span>
                          <input
                            type="number"
                            step="0.1"
                            value={pt.x}
                            onChange={(e) => {
                              const pts = [...room.floorPoints!];
                              pts[i] = { ...pts[i], x: parseFloat(e.target.value) || 0 };
                              setRoom((prev) => prev ? { ...prev, floorPoints: pts } : prev);
                            }}
                            onBlur={() => saveRoom({ floorPoints: room.floorPoints } as Partial<Room>)}
                            className="w-16 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={pt.z}
                            onChange={(e) => {
                              const pts = [...room.floorPoints!];
                              pts[i] = { ...pts[i], z: parseFloat(e.target.value) || 0 };
                              setRoom((prev) => prev ? { ...prev, floorPoints: pts } : prev);
                            }}
                            onBlur={() => saveRoom({ floorPoints: room.floorPoints } as Partial<Room>)}
                            className="w-16 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]"
                          />
                          <button
                            onClick={() => {
                              const pts = room.floorPoints!.filter((_, j) => j !== i);
                              if (pts.length >= 3) {
                                setRoom((prev) => prev ? { ...prev, floorPoints: pts } : prev);
                                saveRoom({ floorPoints: pts } as Partial<Room>);
                              }
                            }}
                            className="text-red-400 hover:text-red-600"
                            title="Remove point"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const pts = [...room.floorPoints!, { x: 0, z: 0 }];
                        setRoom((prev) => prev ? { ...prev, floorPoints: pts } : prev);
                      }}
                      className="text-[10px] text-[var(--primary)] hover:underline mt-1"
                    >
                      + Add point
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
