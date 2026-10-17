"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { X } from "@/components/icons";

// Loaded on demand: the 3D bundle isn't needed until someone opens a panorama.
const PanoramaViewer = dynamic(
  () => import("@/components/three/PanoramaViewer").then((m) => m.PanoramaViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-white/70">Loading 360° view…</div>
    ),
  }
);

interface PanoramaModalProps {
  url: string;
  title?: string;
  onClose: () => void;
}

export function PanoramaModal({ url, title, onClose }: PanoramaModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "360° view"}
      onClick={onClose}
    >
      <div
        className="relative h-full max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <span className="text-sm font-medium text-white">{title ?? "360° view"}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md bg-black/50 p-1.5 text-white/90 hover:bg-black/75"
          >
            <X size={16} />
          </button>
        </div>
        <PanoramaViewer url={url} />
      </div>
    </div>
  );
}
