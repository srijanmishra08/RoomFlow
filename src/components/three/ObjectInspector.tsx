"use client";

import { useState } from "react";
import { statusColor, statusLabel, formatCurrency, formatDate } from "@/lib/utils";
import type { RoomObjectData } from "./RoomViewer";

interface ObjectInspectorProps {
  object: RoomObjectData;
  isEditable?: boolean;
  onUpdate?: (data: Partial<RoomObjectData>) => void;
  onDelete?: () => void;
  onComment?: (content: string) => void;
}

export function ObjectInspector({
  object,
  isEditable = false,
  onUpdate,
  onDelete,
  onComment,
}: ObjectInspectorProps) {
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: object.name,
    status: object.status,
    material: object.material || "",
    brand: object.brand || "",
    cost: object.cost?.toString() || "",
    supplier: object.supplier || "",
  });

  function handleSave() {
    onUpdate?.({
      name: editData.name,
      status: editData.status,
      material: editData.material || null,
      brand: editData.brand || null,
      cost: editData.cost ? parseFloat(editData.cost) : null,
      supplier: editData.supplier || null,
    } as any);
    setEditing(false);
  }

  function handleComment() {
    if (!commentText.trim()) return;
    onComment?.(commentText);
    setCommentText("");
  }

  return (
    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            <input
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="text-lg font-semibold bg-transparent border-b border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
            />
          ) : (
            <h3 className="text-lg font-semibold">{object.name}</h3>
          )}
        </div>
        <span
          className="status-badge"
          style={{ backgroundColor: statusColor(object.status) + "20", color: statusColor(object.status) }}
        >
          ● {statusLabel(object.status)}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        {editing ? (
          <>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Status</label>
              <select
                value={editData.status}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
              >
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="FINALIZED">Finalized</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Material</label>
              <input
                value={editData.material}
                onChange={(e) => setEditData({ ...editData, material: e.target.value })}
                className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Brand</label>
              <input
                value={editData.brand}
                onChange={(e) => setEditData({ ...editData, brand: e.target.value })}
                className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Supplier</label>
              <input
                value={editData.supplier}
                onChange={(e) => setEditData({ ...editData, supplier: e.target.value })}
                className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Cost</label>
              <input
                value={editData.cost}
                type="number"
                onChange={(e) => setEditData({ ...editData, cost: e.target.value })}
                className="w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-sm mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1 rounded text-xs"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1 rounded text-xs border border-[var(--border)]"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {object.material && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Material</span>
                <span>{object.material}</span>
              </div>
            )}
            {object.brand && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Brand</span>
                <span>{object.brand}</span>
              </div>
            )}
            {object.supplier && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Supplier</span>
                <span>{object.supplier}</span>
              </div>
            )}
            {object.cost != null && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Cost</span>
                <span className="font-medium">
                  {formatCurrency(object.cost, object.currency)}
                </span>
              </div>
            )}
            {object.deliveryDate && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Delivery</span>
                <span>{formatDate(object.deliveryDate)}</span>
              </div>
            )}

            {isEditable && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  Edit details
                </button>
                <button
                  onClick={onDelete}
                  className="text-xs text-[var(--destructive)] hover:underline"
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Position info */}
      <div className="text-xs text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]">
        Position: ({object.positionX.toFixed(1)}, {object.positionY.toFixed(1)},{" "}
        {object.positionZ.toFixed(1)})
      </div>

      {/* Comments */}
      <div className="pt-2 border-t border-[var(--border)]">
        <h4 className="text-sm font-medium mb-2">
          Comments ({object.comments?.length || 0})
        </h4>

        {object.comments && object.comments.length > 0 && (
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            {object.comments.map((comment) => (
              <div key={comment.id} className="text-xs p-2 rounded bg-[var(--secondary)]">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{comment.user.name}</span>
                  <span className="text-[var(--muted-foreground)]">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p>{comment.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleComment()}
          />
          <button
            onClick={handleComment}
            className="px-3 py-1.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-xs"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
