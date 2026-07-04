"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ObjectInspector } from "@/components/three/ObjectInspector";
import { RevisionManager } from "@/components/RevisionManager";
import type { RoomObjectData, CaptureFn } from "@/components/three/RoomViewer";
import type { SurfaceMaterial, FloorPoint, WallOpening } from "@/components/three/RoomBox";
import { FloorPlanEditor } from "@/components/three/FloorPlanEditor";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import {
  FURNITURE_CATALOG,
  CATALOG_CATEGORIES,
  kindTag,
  type CatalogItem,
} from "@/lib/furniture-catalog";
import { searchCatalog, autoFurnish, inferRoomKind, PALETTES, colorForKind, type Palette } from "@/lib/auto-furnish";
import { resolveKind } from "@/lib/furniture-catalog";
import { PBR_TEXTURES } from "@/lib/pbr-textures";
import { snapToNeighbours } from "@/lib/editor-tools";
import { Upload, Sofa, Grid, Camera, ImageIcon, Copy as CopyIcon, Ruler, Magnet, Undo2, Redo2, Move, RotateCw, Scaling } from "@/components/icons";

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
  openings?: WallOpening[] | null;
  modelUrl?: string | null;
  floorMaterial?: SurfaceMaterial | null;
  wallMaterial?: SurfaceMaterial | null;
  ceilingMaterial?: SurfaceMaterial | null;
}

interface RevisionData {
  id: string;
  version: number;
  label: string;
  type: string;
  status: string;
  sourceFileUrl: string;
  sceneUrl: string | null;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Asset {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  category: string | null;
}

interface SavedView {
  id: string;
  name: string;
  revisionId: string | null;
  cameraPosition: { x: number; y: number; z: number };
  cameraRotation: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
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
  surface,
}: {
  label: string;
  value: SurfaceMaterial | null;
  onChange: (mat: SurfaceMaterial | null) => void;
  surface?: "floor" | "wall" | "ceiling";
}) {
  const current = value?.type === "color" ? value.value : null;
  const currentTexture = value?.type === "texture" ? value.value : null;
  const textures = surface ? PBR_TEXTURES.filter((t) => t.surfaces.includes(surface)) : [];

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {textures.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {textures.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              onClick={() => onChange({ type: "texture", value: t.id })}
              className="px-1.5 py-0.5 rounded border text-[10px] flex items-center gap-1 transition hover:scale-105"
              style={{
                borderColor: currentTexture === t.id ? "var(--primary)" : "var(--border)",
                outline: currentTexture === t.id ? "2px solid var(--primary)" : "none",
                outlineOffset: "1px",
              }}
            >
              <span className="w-3 h-3 rounded-sm border border-black/10" style={{ backgroundColor: t.swatch }} />
              {t.label}
            </button>
          ))}
        </div>
      )}
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [measureMode, setMeasureMode] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Single source of truth for selection. Shift-click toggles membership;
  // plain click replaces the selection. selectedId is the primary (gizmo).
  const selectObject = useCallback((id: string | null, additive?: boolean) => {
    if (id === null) {
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }
    if (additive) {
      setSelectedIds((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        setSelectedId(has ? next[next.length - 1] ?? null : id);
        return next;
      });
    } else {
      setSelectedId(id);
      setSelectedIds([id]);
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [renders, setRenders] = useState<{ id: string; fileUrl: string; name: string }[]>([]);
  const [rendering, setRendering] = useState(false);
  const captureRef = useRef<CaptureFn | null>(null);
  const [showRenderMenu, setShowRenderMenu] = useState(false);
  // The room's non-revision modelUrl, captured on load and kept in sync with
  // Quick Upload / Remove design-file so "Current" and revision-delete can restore it.
  const originalModelUrlRef = useRef<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<"translate" | "rotate" | "scale">("translate");
  const historyRef = useRef<{ id: string; before: Partial<RoomObjectData> }[]>([]);
  const redoRef = useRef<{ id: string; before: Partial<RoomObjectData> }[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Snapshot the given fields of an object before mutating, for undo.
  const pushHistory = useCallback((id: string, before: Partial<RoomObjectData>) => {
    historyRef.current.push({ id, before });
    if (historyRef.current.length > 50) historyRef.current.shift();
    setCanUndo(true);
    redoRef.current = []; // new edit invalidates redo stack
    setCanRedo(false);
  }, []);
  const [catalogCat, setCatalogCat] = useState<string>("seating");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [selectedAssetUrl, setSelectedAssetUrl] = useState("");
  const [activePanel, setActivePanel] = useState<"inspector" | "materials" | "shape" | "openings" | "views" | "upload">("inspector");
  const [saving, setSaving] = useState(false);
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    message: string;
    detectedObjects: { id: string; name: string }[];
  } | null>(null);
  const [revisions, setRevisions] = useState<RevisionData[]>([]);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [uploadingRevision, setUploadingRevision] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState("");
  const [cameraSnapshot, setCameraSnapshot] = useState<{
    cameraPosition: { x: number; y: number; z: number };
    cameraRotation: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null>(null);
  const [focusView, setFocusView] = useState<{
    cameraPosition: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null>(null);

  const selectedObject = objects.find((o) => o.id === selectedId) || null;
  const activeRevision = revisions.find((r) => r.id === activeRevisionId) || null;

  useEffect(() => {
    async function load() {
      const [projRes, assetsRes, revisionsRes, viewsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch("/api/assets"),
        fetch(`/api/rooms/${roomId}/revisions`),
        fetch(`/api/rooms/${roomId}/views`),
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
          openings: roomData.openings,
          modelUrl: roomData.modelUrl,
          floorMaterial: roomData.floorMaterial,
          wallMaterial: roomData.wallMaterial,
          ceilingMaterial: roomData.ceilingMaterial,
        });
        originalModelUrlRef.current = roomData.modelUrl ?? null;
        setObjects(roomData.objects || []);
      }

      if (assetsRes.ok) {
        setAssets(await assetsRes.json());
      }

      if (revisionsRes.ok) {
        const revs: RevisionData[] = await revisionsRes.json();
        setRevisions(revs);
      }

      if (viewsRes.ok) {
        const views: SavedView[] = await viewsRes.json();
        setSavedViews(views);
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

  // Add/update/remove wall openings (doors & windows), persisting to the room.
  const commitOpenings = useCallback(
    (next: WallOpening[]) => {
      setRoom((prev) => (prev ? { ...prev, openings: next } : prev));
      saveRoom({ openings: next } as Partial<Room>);
    },
    [saveRoom]
  );

  // Load saved renders (assets tagged with this room).
  const loadRenders = useCallback(async () => {
    try {
      const res = await fetch("/api/assets");
      if (!res.ok) return;
      const all = await res.json();
      setRenders(
        (all as { id: string; fileUrl: string; name: string; category?: string; tags?: string[] }[])
          .filter((a) => a.category === "render" && (a.tags ?? []).includes(roomId))
          .map((a) => ({ id: a.id, fileUrl: a.fileUrl, name: a.name }))
      );
    } catch {
      /* ignore */
    }
  }, [roomId]);

  useEffect(() => {
    loadRenders();
  }, [loadRenders]);

  // Capture the 3D canvas → PNG, download, and save to the room gallery.
  // Presets: snapshot (canvas size), 1080p, 4K, 360° equirect panorama.
  const captureRender = useCallback(async (preset: "snap" | "1080p" | "4k" | "360" = "snap") => {
    const cap = captureRef.current;
    if (!cap) {
      toast("Viewer not ready yet", "error");
      return;
    }
    setRendering(true);
    setShowRenderMenu(false);
    try {
      const opts =
        preset === "1080p" ? { width: 1920, height: 1080 } :
        preset === "4k" ? { width: 3840, height: 2160 } :
        preset === "360" ? { pano: true } : undefined;
      const label = preset === "snap" ? "Render" : preset === "360" ? "360° Pano" : `Render ${preset}`;
      // Yield a frame so the "Rendering…" state paints before the heavy capture.
      await new Promise((r) => setTimeout(r, 30));
      const dataUrl = cap(opts);
      // Instant download.
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `render-${preset}-${Date.now()}.png`;
      a.click();
      // Persist to gallery via the upload route.
      const blob = await (await fetch(dataUrl)).blob();
      const fd = new FormData();
      fd.append("file", blob, `render-${preset}-${Date.now()}.png`);
      fd.append("name", `${label} ${new Date().toLocaleString()}`);
      fd.append("category", "render");
      fd.append("tags", roomId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        toast("Render saved to gallery", "success");
        loadRenders();
        setShowGallery(true);
      } else {
        toast("Render downloaded (gallery save failed)", "error");
      }
    } catch {
      toast("Render failed", "error");
    } finally {
      setRendering(false);
    }
  }, [roomId, toast, loadRenders]);

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

  const addFromCatalog = useCallback(
    async (item: CatalogItem) => {
      // Stagger placement so pieces don't stack on the origin.
      const n = objects.length;
      const ring = Math.floor(n / 6);
      const ang = (n % 6) * (Math.PI / 3);
      const r = 0.8 + ring * 0.9;
      const data = {
        name: item.name,
        modelUrl: null,
        positionX: Math.round(Math.cos(ang) * r * 10) / 10,
        positionY: 0,
        positionZ: Math.round(Math.sin(ang) * r * 10) / 10,
        scaleX: item.dims[0],
        scaleY: item.dims[1],
        scaleZ: item.dims[2],
        status: "PLANNED",
        material: kindTag(item.kind),
        color: item.color,
        cost: item.price,
        currency: "INR",
      };
      const res = await fetch(`/api/rooms/${roomId}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const obj = await res.json();
        setObjects((prev) => [...prev, { ...obj, comments: [] }]);
        selectObject(obj.id);
        toast(`${item.name} added`, "success");
      } else {
        const err = await res.json().catch(() => ({}));
        toast(`Failed: ${err.error ? JSON.stringify(err.error) : "error"}`, "error");
      }
    },
    [roomId, objects.length, toast]
  );

  // Place a catalog item at an explicit position/rotation (used by auto-furnish).
  const placeFromCatalog = useCallback(
    async (item: CatalogItem, x: number, z: number, rotationY: number) => {
      const data = {
        name: item.name,
        modelUrl: null,
        positionX: Math.round(x * 100) / 100,
        positionY: 0,
        positionZ: Math.round(z * 100) / 100,
        rotationY: Math.round(rotationY * 1000) / 1000,
        scaleX: item.dims[0],
        scaleY: item.dims[1],
        scaleZ: item.dims[2],
        status: "PLANNED",
        material: kindTag(item.kind),
        color: item.color,
        cost: item.price,
        currency: "INR",
      };
      const res = await fetch(`/api/rooms/${roomId}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const obj = await res.json();
      setObjects((prev) => [...prev, { ...obj, comments: [] }]);
      return obj;
    },
    [roomId]
  );

  const autoFurnishRoom = useCallback(async () => {
    if (!room || autoFilling) return;
    setAutoFilling(true);
    try {
      const kind = inferRoomKind(room.name);
      const placements = autoFurnish(kind, room.width, room.depth);
      let placed = 0;
      for (const p of placements) {
        const obj = await placeFromCatalog(p.item, p.x, p.z, p.rotationY);
        if (obj) placed++;
      }
      toast(`Auto-furnished as ${kind}: ${placed} pieces added`, placed ? "success" : "error");
    } finally {
      setAutoFilling(false);
    }
  }, [room, autoFilling, placeFromCatalog, toast]);

  const restyleRoom = useCallback(
    async (palette: Palette) => {
      const targets = objects.map((o) => ({ o, color: colorForKind(resolveKind(o.material, o.name), palette) }));
      setObjects((prev) =>
        prev.map((o) => {
          const t = targets.find((x) => x.o.id === o.id);
          return t ? { ...o, color: t.color } : o;
        })
      );
      await Promise.all(
        targets.map(({ o, color }) =>
          fetch(`/api/objects/${o.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ color }),
          })
        )
      );
      toast(`Restyled: ${palette.label}`, "success");
    },
    [objects, toast]
  );

  const moveObject = useCallback(
    async (id: string, x: number, y: number, z: number) => {
      setObjects((prev) => {
        const o = prev.find((p) => p.id === id);
        if (o) pushHistory(id, { positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ });
        return prev.map((p) => (p.id === id ? { ...p, positionX: x, positionY: y, positionZ: z } : p));
      });
      await fetch(`/api/objects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionX: x, positionY: y, positionZ: z }),
      });
    },
    [pushHistory]
  );

  // Commit a translate/rotate/scale gizmo change. Applies edge/center snapping
  // (translate only) and moves the rest of a multi-selection by the same delta.
  const transformObject = useCallback(
    async (id: string, patch: {
      positionX: number; positionY: number; positionZ: number;
      rotationY: number; scaleX: number; scaleY: number; scaleZ: number;
    }) => {
      const o = objects.find((p) => p.id === id);
      if (!o) return;
      const next = { ...patch };
      if (snapEnabled && gizmoMode === "translate" && room) {
        const snapped = snapToNeighbours(
          { id, positionX: next.positionX, positionZ: next.positionZ, scaleX: next.scaleX, scaleZ: next.scaleZ },
          next.positionX,
          next.positionZ,
          objects
            .filter((p) => p.id !== id && !selectedIds.includes(p.id))
            .map((p) => ({ id: p.id, positionX: p.positionX, positionZ: p.positionZ, scaleX: p.scaleX, scaleZ: p.scaleZ })),
          { width: room.width, depth: room.depth }
        );
        next.positionX = snapped.x;
        next.positionZ = snapped.z;
      }
      pushHistory(id, {
        positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ,
        rotationY: o.rotationY, scaleX: o.scaleX, scaleY: o.scaleY, scaleZ: o.scaleZ,
      });
      setObjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...next } : p)));
      await fetch(`/api/objects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      // Group move: shift the other selected pieces by the same floor delta.
      const dx = next.positionX - o.positionX;
      const dz = next.positionZ - o.positionZ;
      const followers = selectedIds.filter((sid) => sid !== id && objects.some((p) => p.id === sid));
      if ((dx !== 0 || dz !== 0) && gizmoMode === "translate" && followers.length > 0) {
        followers.forEach((fid) => {
          const f = objects.find((p) => p.id === fid);
          if (f) pushHistory(fid, { positionX: f.positionX, positionZ: f.positionZ });
        });
        setObjects((prev) =>
          prev.map((p) =>
            followers.includes(p.id)
              ? { ...p, positionX: +(p.positionX + dx).toFixed(2), positionZ: +(p.positionZ + dz).toFixed(2) }
              : p
          )
        );
        await Promise.all(
          followers.map((fid) => {
            const f = objects.find((p) => p.id === fid)!;
            return fetch(`/api/objects/${fid}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                positionX: +(f.positionX + dx).toFixed(2),
                positionZ: +(f.positionZ + dz).toFixed(2),
              }),
            });
          })
        );
      }
    },
    [objects, selectedIds, snapEnabled, gizmoMode, room, pushHistory]
  );

  // Apply a snapshot, capturing the inverse onto the opposite stack.
  const applySnapshot = useCallback(
    async (entry: { id: string; before: Partial<RoomObjectData> }, into: typeof redoRef) => {
      setObjects((prev) => {
        const o = prev.find((p) => p.id === entry.id);
        if (o) {
          // Capture current values of the same fields as the inverse.
          const inverse: Partial<RoomObjectData> = {};
          for (const k of Object.keys(entry.before) as (keyof RoomObjectData)[]) {
            (inverse as Record<string, unknown>)[k] = o[k];
          }
          into.current.push({ id: entry.id, before: inverse });
        }
        return prev.map((p) => (p.id === entry.id ? { ...p, ...entry.before } : p));
      });
      await fetch(`/api/objects/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.before),
      });
    },
    []
  );

  const undo = useCallback(async () => {
    const last = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    if (!last) return;
    await applySnapshot(last, redoRef);
    setCanRedo(true);
  }, [applySnapshot]);

  const redo = useCallback(async () => {
    const next = redoRef.current.pop();
    setCanRedo(redoRef.current.length > 0);
    if (!next) return;
    await applySnapshot(next, historyRef);
    setCanUndo(true);
  }, [applySnapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

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

  // Deletes the whole selection (single or multi).
  const deleteObject = useCallback(async () => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    if (!confirm(ids.length === 1 ? "Delete this object?" : `Delete ${ids.length} objects?`)) return;
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/objects/${id}`, { method: "DELETE" }))
    );
    const deleted = ids.filter((_, i) => results[i].ok);
    if (deleted.length > 0) {
      setObjects((prev) => prev.filter((o) => !deleted.includes(o.id)));
      selectObject(null);
      toast(deleted.length === 1 ? "Object deleted" : `${deleted.length} objects deleted`, "success");
    }
  }, [selectedId, selectedIds, selectObject, toast]);

  // Clone an object's editable fields, nudged so the copy is visible.
  const cloneObject = useCallback(
    async (src: RoomObjectData, dx = 0.3, dz = 0.3) => {
      const data = {
        name: src.name,
        modelUrl: src.modelUrl,
        positionX: Math.round((src.positionX + dx) * 100) / 100,
        positionY: src.positionY,
        positionZ: Math.round((src.positionZ + dz) * 100) / 100,
        rotationX: src.rotationX,
        rotationY: src.rotationY,
        rotationZ: src.rotationZ,
        scaleX: src.scaleX,
        scaleY: src.scaleY,
        scaleZ: src.scaleZ,
        status: src.status,
        material: src.material,
        color: src.color,
        cost: src.cost,
        currency: src.currency,
        brand: src.brand,
        supplier: src.supplier,
      };
      const res = await fetch(`/api/rooms/${roomId}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const obj = await res.json();
      setObjects((prev) => [...prev, { ...obj, comments: [] }]);
      selectObject(obj.id);
      return obj;
    },
    [roomId, selectObject]
  );

  const clipboardRef = useRef<RoomObjectData | null>(null);

  const duplicateSelected = useCallback(async () => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    const sources = objects.filter((o) => ids.includes(o.id));
    if (sources.length === 0) return;
    for (const src of sources) await cloneObject(src);
    toast(sources.length === 1 ? "Duplicated" : `${sources.length} objects duplicated`, "success");
  }, [objects, selectedId, selectedIds, cloneObject, toast]);

  const copySelected = useCallback(() => {
    const src = objects.find((o) => o.id === selectedId);
    if (!src) return;
    clipboardRef.current = src;
    toast("Copied", "success");
  }, [objects, selectedId, toast]);

  const pasteClipboard = useCallback(async () => {
    if (!clipboardRef.current) return;
    await cloneObject(clipboardRef.current, 0.4, 0.4);
    toast("Pasted", "success");
  }, [cloneObject, toast]);

  // Nudge the whole selection on the floor plane (metres).
  const nudgeSelection = useCallback(
    async (dx: number, dz: number) => {
      const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
      if (ids.length === 0) return;
      const targets = objects.filter((o) => ids.includes(o.id));
      targets.forEach((t) => pushHistory(t.id, { positionX: t.positionX, positionZ: t.positionZ }));
      setObjects((prev) =>
        prev.map((p) =>
          ids.includes(p.id)
            ? { ...p, positionX: +(p.positionX + dx).toFixed(2), positionZ: +(p.positionZ + dz).toFixed(2) }
            : p
        )
      );
      await Promise.all(
        targets.map((t) =>
          fetch(`/api/objects/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              positionX: +(t.positionX + dx).toFixed(2),
              positionZ: +(t.positionZ + dz).toFixed(2),
            }),
          })
        )
      );
    },
    [objects, selectedId, selectedIds, pushHistory]
  );

  // Editor keyboard shortcuts: duplicate / copy / paste / delete / nudge / escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") { selectObject(null); setMeasureMode(false); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId || selectedIds.length > 0) { e.preventDefault(); deleteObject(); }
        return;
      }
      if (e.key.startsWith("Arrow") && (selectedId || selectedIds.length > 0)) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.1;
        if (e.key === "ArrowLeft") nudgeSelection(-step, 0);
        else if (e.key === "ArrowRight") nudgeSelection(step, 0);
        else if (e.key === "ArrowUp") nudgeSelection(0, -step);
        else if (e.key === "ArrowDown") nudgeSelection(0, step);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "d") { e.preventDefault(); duplicateSelected(); }
      else if (k === "c") { copySelected(); }
      else if (k === "v") { pasteClipboard(); }
      else if (k === "a") {
        e.preventDefault();
        setSelectedIds(objects.map((o) => o.id));
        setSelectedId(objects[objects.length - 1]?.id ?? null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duplicateSelected, copySelected, pasteClipboard, deleteObject, nudgeSelection, selectObject, selectedId, selectedIds, objects]);

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

  const uploadDesignFile = useCallback(
    async (file: File) => {
      setUploadingDesign(true);
      setUploadResult(null);
      const fd = new FormData();
      fd.append("file", file);

      try {
        const res = await fetch(`/api/rooms/${roomId}/upload-design`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (res.ok) {
          setUploadResult({
            message: data.message,
            detectedObjects: data.detectedObjects || [],
          });

          // If 3D file, update the room's modelUrl
          if (data.fileType === "3d" && data.fileUrl) {
            originalModelUrlRef.current = data.fileUrl;
            setRoom((prev) => prev ? { ...prev, modelUrl: data.fileUrl } : prev);
          }

          // If image upload generated a sceneUrl, use it
          if (data.sceneUrl) {
            originalModelUrlRef.current = data.sceneUrl;
            setRoom((prev) => prev ? { ...prev, modelUrl: data.sceneUrl } : prev);
          }

          // If a revision was created, add it to the list
          if (data.revisionId) {
            const revRes = await fetch(`/api/rooms/${roomId}/revisions`);
            if (revRes.ok) {
              const revs: RevisionData[] = await revRes.json();
              setRevisions(revs);
              // Auto-select the new revision
              const newRev = revs.find((r) => r.id === data.revisionId);
              if (newRev) {
                setActiveRevisionId(newRev.id);
              }
            }
          }

          // Add detected objects to the local objects list
          if (data.detectedObjects?.length) {
            setObjects((prev) => [
              ...prev,
              ...data.detectedObjects.map((o: RoomObjectData) => ({ ...o, comments: [] })),
            ]);
          }

          toast(data.message, "success");
        } else {
          toast(data.error || "Upload failed", "error");
        }
      } catch {
        toast("Upload failed", "error");
      } finally {
        setUploadingDesign(false);
      }
    },
    [roomId, toast]
  );

  const createRevision = useCallback(
    async (file: File, label?: string) => {
      setUploadingRevision(true);
      const fd = new FormData();
      fd.append("file", file);
      if (label) fd.append("label", label);

      try {
        const res = await fetch(`/api/rooms/${roomId}/revisions`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (res.ok) {
          setRevisions((prev) => [...prev, data]);
          setActiveRevisionId(data.id);
          setRevisionLabel("");

          // If it has a sceneUrl, update room modelUrl for the viewer
          if (data.sceneUrl) {
            setRoom((prev) => prev ? { ...prev, modelUrl: data.sceneUrl } : prev);
          }

          toast(`Revision "${data.label}" created`, "success");
        } else {
          toast(data.error || "Failed to create revision", "error");
        }
      } catch {
        toast("Failed to create revision", "error");
      } finally {
        setUploadingRevision(false);
      }
    },
    [roomId, toast]
  );

  const deleteRevision = useCallback(
    async (revisionId: string) => {
      if (!confirm("Delete this revision?")) return;
      const res = await fetch(`/api/rooms/${roomId}/revisions/${revisionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRevisions((prev) => prev.filter((r) => r.id !== revisionId));
        if (activeRevisionId === revisionId) {
          setActiveRevisionId(null);
          // Restore room's original modelUrl
          setRoom((prev) => (prev ? { ...prev, modelUrl: originalModelUrlRef.current } : prev));
        }
        toast("Revision deleted", "success");
      }
    },
    [roomId, activeRevisionId, toast]
  );

  const saveCurrentView = useCallback(async () => {
    if (!cameraSnapshot) {
      toast("Move the camera first to capture a view", "error");
      return;
    }

    const name = newViewName.trim() || `View ${savedViews.length + 1}`;
    const res = await fetch(`/api/rooms/${roomId}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revisionId: activeRevisionId,
        name,
        cameraPosition: cameraSnapshot.cameraPosition,
        cameraRotation: cameraSnapshot.cameraRotation,
        target: cameraSnapshot.target,
      }),
    });

    if (!res.ok) {
      toast("Failed to save view", "error");
      return;
    }

    const created: SavedView = await res.json();
    setSavedViews((prev) => [...prev, created]);
    setNewViewName("");
    toast("View saved", "success");
  }, [cameraSnapshot, newViewName, savedViews.length, roomId, activeRevisionId, toast]);

  const removeSavedView = useCallback(async (viewId: string) => {
    const res = await fetch(`/api/rooms/${roomId}/views/${viewId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Failed to delete view", "error");
      return;
    }
    setSavedViews((prev) => prev.filter((view) => view.id !== viewId));
  }, [roomId, toast]);

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
            onClick={() => setActivePanel("upload")}
            className="border border-[var(--primary)] text-[var(--primary)] px-3 py-1.5 rounded-lg text-sm hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] transition"
          >
            <Upload size={15} className="inline -mt-0.5 mr-1.5" />Upload Design
          </button>
          <button
            onClick={() => { setShowCatalog((v) => !v); setShowAddForm(false); }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${
              showCatalog
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                : "border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
            }`}
          >
            <Sofa size={15} className="inline -mt-0.5 mr-1.5" />Catalog
          </button>
          <button
            onClick={() => setShowFloorPlan(true)}
            className="px-3 py-1.5 rounded-lg text-sm border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] transition"
          >
            <Grid size={15} className="inline -mt-0.5 mr-1.5" />Floor Plan
          </button>
          <div className="relative">
            <button
              onClick={() => setShowRenderMenu((v) => !v)}
              disabled={rendering}
              className="px-3 py-1.5 rounded-lg text-sm bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {rendering ? "Rendering…" : <><Camera size={15} className="inline -mt-0.5 mr-1.5" />Render ▾</>}
            </button>
            {showRenderMenu && !rendering && (
              <div className="fixed inset-0 z-10" onClick={() => setShowRenderMenu(false)} />
            )}
            {showRenderMenu && !rendering && (
              <div className="absolute z-20 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
                {([
                  { p: "snap", label: "Snapshot (view size)" },
                  { p: "1080p", label: "Full HD (1920×1080)" },
                  { p: "4k", label: "4K (3840×2160)" },
                  { p: "360", label: "360° Panorama" },
                ] as const).map((o) => (
                  <button
                    key={o.p}
                    onClick={() => captureRender(o.p)}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-[var(--muted)]"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowGallery((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${
              showGallery
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                : "border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
            }`}
          >
            <ImageIcon size={15} className="inline -mt-0.5 mr-1.5" />Gallery{renders.length ? ` (${renders.length})` : ""}
          </button>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowCatalog(false); }}
            className="bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 rounded-lg text-sm"
          >
            + Custom
          </button>
          {selectedId && (
            <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden ml-1">
              {([
                { m: "translate", icon: <Move size={14} />, label: "Move" },
                { m: "rotate", icon: <RotateCw size={14} />, label: "Rotate" },
                { m: "scale", icon: <Scaling size={14} />, label: "Scale" },
              ] as const).map((g) => (
                <button
                  key={g.m}
                  onClick={() => setGizmoMode(g.m)}
                  title={g.label}
                  className={`px-2.5 py-1.5 text-sm transition ${
                    gizmoMode === g.m
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "hover:bg-[var(--muted)]"
                  }`}
                >
                  {g.icon}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setMeasureMode((v) => !v)}
            title="Measure distance (click two points on the floor)"
            className={`px-2.5 py-1.5 rounded-lg text-sm border transition ml-1 ${
              measureMode
                ? "bg-amber-500 text-white border-amber-500"
                : "border-[var(--border)] hover:bg-[var(--muted)]"
            }`}
          >
            <Ruler size={15} />
          </button>
          <button
            onClick={() => setSnapEnabled((v) => !v)}
            title={snapEnabled ? "Snapping on (edges/centers/walls)" : "Snapping off"}
            className={`px-2.5 py-1.5 rounded-lg text-sm border transition ${
              snapEnabled
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                : "border-[var(--border)] hover:bg-[var(--muted)]"
            }`}
          >
            <Magnet size={15} />
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            className="px-2.5 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-40 ml-1"
          >
            <Undo2 size={14} className="inline -mt-0.5 mr-1" />Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            className="px-2.5 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-40 ml-1"
          >
            <Redo2 size={14} className="inline -mt-0.5 mr-1" />Redo
          </button>
          {selectedId && (
            <button
              onClick={duplicateSelected}
              title="Duplicate (⌘D)"
              className="px-2.5 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--muted)] ml-1"
            >
              <CopyIcon size={14} className="inline -mt-0.5 mr-1" />Duplicate
            </button>
          )}
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

      {/* 2D Floor Plan Editor */}
      {showFloorPlan && (
        <FloorPlanEditor
          floorPoints={room.floorPoints}
          width={room.width}
          depth={room.depth}
          onChange={(pts) => {
            setRoom((prev) => prev ? { ...prev, floorPoints: pts } : prev);
            saveRoom({ floorPoints: pts } as Partial<Room>);
          }}
          openings={room.openings}
          onOpeningsChange={commitOpenings}
          onClose={() => setShowFloorPlan(false)}
        />
      )}

      {/* Render Gallery */}
      {showGallery && (
        <div className="p-4 rounded-xl border border-[var(--border)] mb-3 bg-[var(--card)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">🖼️ Render Gallery</h3>
            <span className="text-xs text-[var(--muted-foreground)]">{renders.length} render{renders.length === 1 ? "" : "s"}</span>
          </div>
          {renders.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">No renders yet. Click Render to capture the current view.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {renders.map((r) => (
                <a key={r.id} href={r.fileUrl} download target="_blank" rel="noopener noreferrer" className="group block rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--primary)] transition">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.fileUrl} alt={r.name} className="w-full aspect-video object-cover" />
                  <p className="text-[10px] truncate px-1.5 py-1 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">{r.name}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Furniture Catalog */}
      {showCatalog && (
        <div className="p-4 rounded-xl border border-[var(--border)] mb-3 bg-[var(--card)]">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-sm font-semibold whitespace-nowrap">Furniture Catalog</h3>
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search furniture… (e.g. couch, lamp, storage)"
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)]"
            />
            <button
              onClick={autoFurnishRoom}
              disabled={autoFilling}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50 whitespace-nowrap"
            >
              {autoFilling ? "Furnishing…" : "✨ Auto-furnish"}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">🎨 Restyle:</span>
            {PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => restyleRoom(p)}
                title={p.label}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] transition"
              >
                <span className="flex">
                  {[p.upholstery, p.wood, p.metal, p.accent].map((c, i) => (
                    <span key={i} className="w-3 h-3 rounded-full -ml-0.5 first:ml-0 border border-black/10" style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span className="text-[10px]">{p.label}</span>
              </button>
            ))}
          </div>
          <div className={`flex gap-1.5 flex-wrap mb-3 ${catalogSearch.trim() ? "hidden" : ""}`}>
            {CATALOG_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCatalogCat(cat.id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                  catalogCat === cat.id
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border-[var(--border)] hover:border-[var(--primary)]"
                }`}
              >
                <span className="mr-1">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {(catalogSearch.trim()
              ? searchCatalog(catalogSearch)
              : FURNITURE_CATALOG.filter((it) => it.category === catalogCat)
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => addFromCatalog(item)}
                className="group flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)] hover:shadow-md transition text-center"
              >
                <span
                  className="w-9 h-9 rounded-md border border-black/10 shadow-inner"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-medium leading-tight">{item.name}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {item.dims[0]}×{item.dims[2]}m · ₹{item.price.toLocaleString("en-IN")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
        <div className="flex-1 flex flex-col">
          {/* Revision bar */}
          {revisions.length > 0 && (
            <div className="flex items-center gap-2 mb-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
              <span className="text-xs font-medium text-[var(--muted-foreground)] shrink-0">Revisions:</span>
              <button
                onClick={() => {
                  setActiveRevisionId(null);
                  // Restore original room model
                  setRoom((prev) => (prev ? { ...prev, modelUrl: originalModelUrlRef.current } : prev));
                }}
                className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition ${
                  !activeRevisionId
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)]"
                }`}
              >
                Current
              </button>
              {revisions.map((rev) => {
                const isActive = activeRevisionId === rev.id;
                const statusIcon =
                  rev.status === "READY" ? "✓" : rev.status === "PROCESSING" ? "⏳" : "✕";
                return (
                  <div key={rev.id} className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setActiveRevisionId(rev.id);
                        if (rev.sceneUrl) {
                          setRoom((prev) => prev ? { ...prev, modelUrl: rev.sceneUrl } : prev);
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition flex items-center gap-1 ${
                        isActive
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)]"
                      }`}
                      title={`v${rev.version} — ${rev.type} (${rev.status})`}
                    >
                      <span className="text-[10px]">{statusIcon}</span>
                      {rev.label}
                    </button>
                    <button
                      onClick={() => deleteRevision(rev.id)}
                      className="text-[10px] text-red-400 hover:text-red-600"
                      title="Delete revision"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active revision info banner */}
          {activeRevision && (
            <div className="mb-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-700">
                  Viewing: {activeRevision.label} (v{activeRevision.version})
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  activeRevision.status === "READY"
                    ? "bg-emerald-100 text-emerald-700"
                    : activeRevision.status === "PROCESSING"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {activeRevision.status}
                </span>
                <span className="text-[10px] text-blue-500">{activeRevision.type.replace("_", " ")}</span>
              </div>
              {activeRevision.thumbnail && (
                <div className="flex items-center gap-2">
                  <img src={activeRevision.thumbnail} alt="" className="w-8 h-8 rounded object-cover border border-blue-200" />
                  <span className="text-[10px] text-blue-500">Source image</span>
                </div>
              )}
            </div>
          )}

          {/* 3D Viewer — always render, revisions now generate real GLB scenes */}
          {activeRevision && activeRevision.status === "FAILED" ? (
            <div className="flex-1 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--secondary)] flex flex-col items-center justify-center p-4">
              <p className="text-3xl mb-3">⚠️</p>
              <p className="text-sm font-medium text-red-600">3D generation failed</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {(activeRevision.metadata as Record<string, unknown>)?.error
                  ? String((activeRevision.metadata as Record<string, unknown>).error)
                  : "An error occurred while generating the 3D scene."}
              </p>
              {activeRevision.thumbnail && (
                <img
                  src={activeRevision.thumbnail}
                  alt={activeRevision.label}
                  className="mt-4 max-h-[40%] max-w-full object-contain rounded-lg shadow-md"
                />
              )}
            </div>
          ) : (
            <div className="flex-1">
              <RoomViewer
                width={room.width}
                height={room.height}
                depth={room.depth}
                objects={objects}
                selectedId={selectedId}
                selectedIds={selectedIds}
                onSelect={selectObject}
                measureMode={measureMode}
                isEditable={true}
                onObjectMove={moveObject}
                onObjectTransform={transformObject}
                gizmoMode={gizmoMode}
                onCaptureReady={(fn) => { captureRef.current = fn; }}
                floorPoints={(!activeRevision || !activeRevision.sceneUrl) ? room.floorPoints : undefined}
                openings={(!activeRevision || !activeRevision.sceneUrl) ? room.openings : undefined}
                roomModelUrl={activeRevision?.sceneUrl ?? room.modelUrl}
                floorMaterial={room.floorMaterial}
                wallMaterial={room.wallMaterial}
                ceilingMaterial={room.ceilingMaterial}
                onCameraSnapshot={setCameraSnapshot}
                focusView={focusView}
              />
            </div>
          )}
        </div>

        {/* Side panel with tabs */}
        <div className="w-80 shrink-0 flex flex-col">
          <div className="mb-2">
            <RevisionManager
              roomId={roomId}
              revisions={revisions}
              selectedRevisionId={activeRevisionId}
              onSelect={(revisionId) => {
                setActiveRevisionId(revisionId);
                if (!revisionId) {
                  setRoom((prev) => (prev ? { ...prev, modelUrl: originalModelUrlRef.current } : prev));
                  return;
                }
                const revision = revisions.find((item) => item.id === revisionId);
                if (revision?.sceneUrl) {
                  setRoom((prev) => prev ? { ...prev, modelUrl: revision.sceneUrl } : prev);
                }
              }}
              onRefresh={async () => {
                const res = await fetch(`/api/rooms/${roomId}/revisions`);
                if (res.ok) {
                  const revs: RevisionData[] = await res.json();
                  setRevisions(revs);
                }
              }}
            />
          </div>

          <div className="flex border-b border-[var(--border)] mb-2">
            {(["inspector", "materials", "shape", "openings", "views", "upload"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActivePanel(tab)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition capitalize ${
                  activePanel === tab
                    ? "border-[var(--primary)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab === "upload" ? "📁 Upload" : tab === "views" ? "🎯 Views" : tab === "openings" ? "🚪 Openings" : tab}
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
                  label="Floor"
                  surface="floor"
                  value={room.floorMaterial ?? null}
                  onChange={(mat) => {
                    setRoom((prev) => prev ? { ...prev, floorMaterial: mat } : prev);
                    saveRoom({ floorMaterial: mat } as Partial<Room>);
                  }}
                />
                <ColorPicker
                  label="Walls"
                  surface="wall"
                  value={room.wallMaterial ?? null}
                  onChange={(mat) => {
                    setRoom((prev) => prev ? { ...prev, wallMaterial: mat } : prev);
                    saveRoom({ wallMaterial: mat } as Partial<Room>);
                  }}
                />
                <ColorPicker
                  label="Ceiling"
                  surface="ceiling"
                  value={room.ceilingMaterial ?? null}
                  onChange={(mat) => {
                    setRoom((prev) => prev ? { ...prev, ceilingMaterial: mat } : prev);
                    saveRoom({ ceilingMaterial: mat } as Partial<Room>);
                  }}
                />
              </div>
            )}

            {activePanel === "openings" && (() => {
              const openings = room.openings ?? [];
              const wallCount = room.floorPoints && room.floorPoints.length >= 3 ? room.floorPoints.length : 4;
              const wallLabels = room.floorPoints && room.floorPoints.length >= 3
                ? Array.from({ length: wallCount }, (_, i) => `Wall ${i + 1}`)
                : ["Back", "Right", "Front", "Left"];
              const add = (type: "door" | "window") =>
                commitOpenings([
                  ...openings,
                  type === "door"
                    ? { wall: 0, offset: 0.5, width: 0.9, height: 2.05, sill: 0, type }
                    : { wall: 0, offset: 0.5, width: 1.2, height: 1.2, sill: 0.9, type },
                ]);
              const patch = (i: number, p: Partial<WallOpening>) =>
                commitOpenings(openings.map((o, j) => (j === i ? { ...o, ...p } : o)));
              const remove = (i: number) => commitOpenings(openings.filter((_, j) => j !== i));
              return (
                <div className="space-y-3 p-3 rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Doors & Windows</h3>
                    <div className="flex gap-1">
                      <button onClick={() => add("door")} className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">＋ Door</button>
                      <button onClick={() => add("window")} className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">＋ Window</button>
                    </div>
                  </div>
                  {openings.length === 0 && (
                    <p className="text-xs text-[var(--muted-foreground)]">No openings. Add a door or window — it cuts through the wall in 3D.</p>
                  )}
                  {openings.map((o, i) => (
                    <div key={i} className="space-y-2 p-2 rounded-lg border border-[var(--border)] text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{o.type === "door" ? "🚪 Door" : "🪟 Window"} {i + 1}</span>
                        <button onClick={() => remove(i)} className="text-[var(--destructive)] hover:underline">Remove</button>
                      </div>
                      <label className="flex items-center justify-between gap-2">
                        Wall
                        <select value={o.wall} onChange={(e) => patch(i, { wall: +e.target.value })}
                          className="flex-1 px-1.5 py-1 rounded border border-[var(--border)] bg-transparent">
                          {wallLabels.map((l, wi) => <option key={wi} value={wi}>{l}</option>)}
                        </select>
                      </label>
                      {([
                        { k: "offset", label: "Position", min: 0, max: 1, step: 0.05 },
                        { k: "width", label: "Width (m)", min: 0.3, max: 6, step: 0.05 },
                        { k: "height", label: "Height (m)", min: 0.3, max: 3, step: 0.05 },
                        { k: "sill", label: "Sill (m)", min: 0, max: 2.5, step: 0.05 },
                      ] as const).map((f) => (
                        <label key={f.k} className="flex items-center justify-between gap-2">
                          {f.label}
                          <input type="range" min={f.min} max={f.max} step={f.step}
                            value={o[f.k]} onChange={(e) => patch(i, { [f.k]: +e.target.value })}
                            className="flex-1" />
                          <span className="w-10 text-right tabular-nums">{o[f.k].toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}

            {activePanel === "upload" && (
              <div className="space-y-4 p-3 rounded-xl border border-[var(--border)]">
                {/* Revision Upload Section */}
                <div>
                  <h3 className="text-sm font-semibold">Create Revision</h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Upload a design file to create a new revision. 3D files render directly; images are auto-converted to interactive 3D scenes.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted-foreground)]">Revision Label</label>
                  <input
                    type="text"
                    value={revisionLabel}
                    onChange={(e) => setRevisionLabel(e.target.value)}
                    placeholder="e.g., Concept, Final Furniture"
                    className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
                  />
                </div>

                <label
                  className={`flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed cursor-pointer transition ${
                    uploadingRevision
                      ? "border-amber-400 bg-amber-50"
                      : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  <input
                    type="file"
                    accept=".glb,.gltf,.obj,.fbx,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    disabled={uploadingRevision}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) createRevision(f, revisionLabel || undefined);
                      e.target.value = "";
                    }}
                  />
                  {uploadingRevision ? (
                    <div className="text-center">
                      <span className="text-2xl block mb-2">⏳</span>
                      <span className="text-xs text-amber-600 animate-pulse">Creating revision...</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-3xl block mb-2">📐</span>
                      <span className="text-sm font-medium text-[var(--foreground)]">Upload revision file</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] block mt-1">
                        3D: .glb, .gltf, .obj, .fbx &nbsp;|&nbsp; Image: .png, .jpg, .webp
                      </span>
                    </div>
                  )}
                </label>

                {/* Revision list */}
                {revisions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                      Revisions ({revisions.length})
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition ${
                            activeRevisionId === rev.id
                              ? "border-[var(--primary)] bg-blue-50"
                              : "border-[var(--border)] hover:border-[var(--primary)]"
                          }`}
                          onClick={() => setActiveRevisionId(rev.id)}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            rev.status === "READY" ? "bg-emerald-500" :
                            rev.status === "PROCESSING" ? "bg-amber-500 animate-pulse" :
                            "bg-red-500"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{rev.label}</p>
                            <p className="text-[10px] text-[var(--muted-foreground)]">
                              v{rev.version} · {rev.type.replace("_", " ")} · {rev.status.toLowerCase()}
                            </p>
                          </div>
                          {rev.thumbnail && (
                            <img src={rev.thumbnail} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-[var(--border)] pt-3">
                  <h3 className="text-sm font-semibold">Quick Upload</h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Upload a 3D file directly to the room (without creating a revision).
                  </p>
                </div>

                <label
                  className={`flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed cursor-pointer transition ${
                    uploadingDesign
                      ? "border-amber-400 bg-amber-50"
                      : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  <input
                    type="file"
                    accept=".glb,.gltf,.obj,.fbx,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    disabled={uploadingDesign}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadDesignFile(f);
                      e.target.value = "";
                    }}
                  />
                  {uploadingDesign ? (
                    <div className="text-center">
                      <span className="text-2xl block mb-2">⏳</span>
                      <span className="text-xs text-amber-600 animate-pulse">Uploading & analyzing...</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-2xl block mb-1">📁</span>
                      <span className="text-xs text-[var(--foreground)]">Quick upload (no revision)</span>
                    </div>
                  )}
                </label>

                {uploadResult && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-sm font-medium text-emerald-700">{uploadResult.message}</p>
                    {uploadResult.detectedObjects.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-emerald-600 font-medium mb-1">Detected Objects:</p>
                        <ul className="space-y-0.5 text-xs text-emerald-600">
                          {uploadResult.detectedObjects.map((o) => (
                            <li key={o.id}>✓ {o.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {room.modelUrl && (
                  <div className="p-3 rounded-xl border border-[var(--border)] flex items-center gap-3">
                    <span className="text-lg">🎨</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{room.modelUrl.split("/").pop()}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">Current room design file</p>
                    </div>
                    <button
                      onClick={() => {
                        originalModelUrlRef.current = null;
                        setRoom((prev) => prev ? { ...prev, modelUrl: null } : prev);
                        saveRoom({ modelUrl: null } as Partial<Room>);
                      }}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="text-[10px] text-[var(--muted-foreground)] p-2 rounded-lg bg-[var(--secondary)]">
                  <p className="font-medium mb-1">Hybrid 3D Pipeline:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li><strong>3D file</strong> (.glb/.gltf) → renders interactively immediately</li>
                    <li><strong>Floor plan image</strong> → generates 3D room with image as floor texture</li>
                    <li><strong>Interior render</strong> → generates 3D scene with image on curved backdrop</li>
                    <li><strong>Any image</strong> → generates 3D gallery displaying the image</li>
                  </ol>
                </div>
              </div>
            )}

            {activePanel === "views" && (
              <div className="space-y-3 p-3 rounded-xl border border-[var(--border)]">
                <div>
                  <h3 className="text-sm font-semibold">View Finder</h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Save camera angles and attach them to the active revision for one-click client walkthroughs.
                  </p>
                </div>

                <input
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g., Kitchen Entrance"
                  className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                />
                <button
                  onClick={saveCurrentView}
                  className="w-full px-3 py-1.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-sm"
                >
                  Save Current Angle
                </button>

                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {savedViews.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">No saved views yet.</p>
                  ) : (
                    savedViews.map((view) => (
                      <div key={view.id} className="p-2 rounded border border-[var(--border)]">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              if (view.revisionId) setActiveRevisionId(view.revisionId);
                              setFocusView({
                                cameraPosition: view.cameraPosition,
                                target: view.target,
                              });
                            }}
                            className="text-left text-xs font-medium hover:text-[var(--primary)]"
                          >
                            {view.name}
                          </button>
                          <button
                            onClick={() => removeSavedView(view.id)}
                            className="text-[10px] text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                        <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                          {view.revisionId ? "Revision-linked" : "Current room"}
                        </p>
                      </div>
                    ))
                  )}
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
