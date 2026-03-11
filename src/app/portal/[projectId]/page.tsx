"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ObjectInspector } from "@/components/three/ObjectInspector";
import type { RoomObjectData } from "@/components/three/RoomViewer";
import type { SurfaceMaterial, FloorPoint } from "@/components/three/RoomBox";

const RoomViewer = dynamic(
  () => import("@/components/three/RoomViewer").then((mod) => mod.RoomViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
        Loading 3D viewer...
      </div>
    ),
  }
);

interface PortalRoom {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  floorPoints?: FloorPoint[] | null;
  modelUrl?: string | null;
  floorMaterial?: SurfaceMaterial | null;
  wallMaterial?: SurfaceMaterial | null;
  ceilingMaterial?: SurfaceMaterial | null;
  objects: RoomObjectData[];
}

interface PortalProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  designerName: string | null;
  rooms: PortalRoom[];
}

interface Approval {
  id: string;
  status: string;
  note: string | null;
  user: { name: string };
}

export default function ClientPortalPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<PortalProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [guestName, setGuestName] = useState("");
  const [approvals, setApprovals] = useState<Record<string, Approval>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/client-portal/${projectId}`).then((res) => {
        if (!res.ok) throw new Error("Project not found");
        return res.json();
      }),
      fetch(`/api/client-portal/${projectId}/approvals`).then((res) =>
        res.ok ? res.json() : {}
      ),
    ])
      .then(([projectData, approvalData]) => {
        setProject(projectData);
        setApprovals(approvalData);
        if (projectData.rooms.length > 0) {
          setActiveRoomId(projectData.rooms[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

  const activeRoom = project?.rooms.find((r) => r.id === activeRoomId) || null;
  const selectedObject = activeRoom?.objects.find((o) => o.id === selectedId) || null;

  const totalObjects = project?.rooms.reduce((sum, r) => sum + r.objects.length, 0) || 0;
  const finalizedObjects = project?.rooms.reduce(
    (sum, r) => sum + r.objects.filter((o) => o.status === "FINALIZED").length,
    0
  ) || 0;
  const progressPercent = totalObjects > 0 ? Math.round((finalizedObjects / totalObjects) * 100) : 0;

  const handleComment = useCallback(async () => {
    if (!commentText.trim() || !selectedId) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/client-portal/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectId: selectedId,
          content: commentText.trim(),
          guestName: guestName || undefined,
        }),
      });

      if (res.ok) {
        const comment = await res.json();
        // Update local state
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            rooms: prev.rooms.map((room) => ({
              ...room,
              objects: room.objects.map((obj) =>
                obj.id === selectedId
                  ? { ...obj, comments: [comment, ...(obj.comments || [])] }
                  : obj
              ),
            })),
          };
        });
        setCommentText("");
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }, [commentText, selectedId, projectId, guestName]);

  const handleApproval = useCallback(
    async (status: "APPROVED" | "REJECTED" | "REVISION_REQUESTED") => {
      if (!selectedId) return;
      setSubmitting(true);

      try {
        const note = status === "REVISION_REQUESTED" ? prompt("What changes would you like?") : null;
        if (status === "REVISION_REQUESTED" && !note) {
          setSubmitting(false);
          return;
        }

        const res = await fetch(`/api/client-portal/${projectId}/approvals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectId: selectedId, status, note }),
        });

        if (res.ok) {
          const approval = await res.json();
          setApprovals((prev) => ({ ...prev, [selectedId]: approval }));

          // If approved, update object status locally
          if (status === "APPROVED") {
            setProject((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                rooms: prev.rooms.map((room) => ({
                  ...room,
                  objects: room.objects.map((obj) =>
                    obj.id === selectedId ? { ...obj, status: "FINALIZED" } : obj
                  ),
                })),
              };
            });
          }
        }
      } catch {
        // silent
      } finally {
        setSubmitting(false);
      }
    },
    [selectedId, projectId]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--muted-foreground)]">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-xl font-bold">Project Not Found</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            This project link may be invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  const objectApproval = selectedId ? approvals[selectedId] : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">Room<span className="text-[var(--primary)]">Flow</span></span>
              <span className="text-[var(--muted-foreground)]">·</span>
              <span className="text-sm font-medium">Client Portal</span>
            </div>
            <h1 className="text-lg font-bold mt-1">{project.title}</h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              by {project.designerName || "Designer"}
            </p>
          </div>
          <div className="flex items-center gap-6">
            {/* Progress bar */}
            <div className="text-right">
              <p className="text-xs text-[var(--muted-foreground)]">Progress</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-32 h-2 rounded-full bg-[var(--secondary)]">
                  <div
                    className="h-full rounded-full bg-[#22c55e] transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{progressPercent}%</span>
              </div>
            </div>
            {/* Legend */}
            <div className="hidden md:flex items-center gap-3 text-xs">
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
      </header>

      {/* Room tabs */}
      {project.rooms.length > 1 && (
        <div className="border-b border-[var(--border)] bg-[var(--background)]">
          <div className="max-w-7xl mx-auto px-6 flex gap-1 py-2">
            {project.rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => {
                  setActiveRoomId(room.id);
                  setSelectedId(null);
                }}
                className={`px-4 py-1.5 rounded-lg text-sm transition ${
                  activeRoomId === room.id
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex">
        {activeRoom ? (
          <>
            {/* 3D Viewer */}
            <div className="flex-1 p-4">
              <div className="h-full">
                <RoomViewer
                  width={activeRoom.width}
                  height={activeRoom.height}
                  depth={activeRoom.depth}
                  objects={activeRoom.objects}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  isEditable={false}
                  floorPoints={activeRoom.floorPoints}
                  roomModelUrl={activeRoom.modelUrl}
                  floorMaterial={activeRoom.floorMaterial}
                  wallMaterial={activeRoom.wallMaterial}
                  ceilingMaterial={activeRoom.ceilingMaterial}
                />
              </div>
            </div>

            {/* Inspector Panel */}
            <div className="w-96 p-4 border-l border-[var(--border)] overflow-y-auto">
              {selectedObject ? (
                <div className="space-y-4">
                  <ObjectInspector
                    object={selectedObject}
                    isEditable={false}
                  />

                  {/* Approval Section */}
                  <div className="p-4 rounded-xl border border-[var(--border)]">
                    <h4 className="text-sm font-medium mb-3">Approval</h4>
                    {objectApproval ? (
                      <div className="space-y-2">
                        <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          objectApproval.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : objectApproval.status === "REJECTED"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {objectApproval.status === "APPROVED" && "✓ Approved"}
                          {objectApproval.status === "REJECTED" && "✕ Rejected"}
                          {objectApproval.status === "REVISION_REQUESTED" && "↻ Revision Requested"}
                        </div>
                        {objectApproval.note && (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            Note: {objectApproval.note}
                          </p>
                        )}
                        <p className="text-xs text-[var(--muted-foreground)]">
                          You can change your approval below
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted-foreground)] mb-2">
                        Review this item and approve or request changes
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApproval("APPROVED")}
                        disabled={submitting}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleApproval("REVISION_REQUESTED")}
                        disabled={submitting}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50"
                      >
                        ↻ Request Changes
                      </button>
                      <button
                        onClick={() => handleApproval("REJECTED")}
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-lg text-xs border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div className="p-4 rounded-xl border border-[var(--border)]">
                    <h4 className="text-sm font-medium mb-3">
                      Comments ({selectedObject.comments?.length || 0})
                    </h4>

                    {/* Comment input */}
                    <div className="space-y-2 mb-3">
                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-xs"
                      />
                      <div className="flex gap-2">
                        <input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Leave a comment..."
                          className="flex-1 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-xs"
                          onKeyDown={(e) => e.key === "Enter" && handleComment()}
                        />
                        <button
                          onClick={handleComment}
                          disabled={submitting || !commentText.trim()}
                          className="px-3 py-1.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-xs disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    </div>

                    {/* Comment list */}
                    {selectedObject.comments && selectedObject.comments.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedObject.comments.map((comment) => (
                          <div key={comment.id} className="text-xs p-2 rounded bg-[var(--secondary)]">
                            <div className="flex justify-between mb-1">
                              <span className="font-medium">{comment.user.name}</span>
                              <span className="text-[var(--muted-foreground)]">
                                {new Date(comment.createdAt).toLocaleDateString("en-IN")}
                              </span>
                            </div>
                            <p>{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <p className="text-3xl mb-3">🖱️</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Click any object to see details
                  </p>
                  <div className="mt-6 space-y-2 w-full">
                    <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase">
                      Objects in {activeRoom.name}
                    </h4>
                    {activeRoom.objects.map((obj) => (
                      <button
                        key={obj.id}
                        onClick={() => setSelectedId(obj.id)}
                        className="w-full text-left p-2 rounded-lg hover:bg-[var(--secondary)] transition flex items-center justify-between"
                      >
                        <span className="text-sm">{obj.name}</span>
                        <div className="flex items-center gap-2">
                          {approvals[obj.id] && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              approvals[obj.id].status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700"
                                : approvals[obj.id].status === "REJECTED"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {approvals[obj.id].status === "APPROVED" && "✓"}
                              {approvals[obj.id].status === "REJECTED" && "✕"}
                              {approvals[obj.id].status === "REVISION_REQUESTED" && "↻"}
                            </span>
                          )}
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                obj.status === "FINALIZED"
                                  ? "#22c55e"
                                  : obj.status === "IN_PROGRESS"
                                  ? "#eab308"
                                  : "#9ca3af",
                            }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[var(--muted-foreground)]">No rooms in this project yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
