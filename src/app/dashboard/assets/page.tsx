"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/Toast";

interface Asset {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  thumbnail: string | null;
  category: string | null;
  tags: string[];
  createdAt: string;
}

export default function AssetsPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("file");

  useEffect(() => {
    fetch("/api/assets")
      .then((res) => res.json())
      .then((data) => {
        setAssets(data);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(assets.map((a) => a.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const matchSearch =
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchCategory =
        categoryFilter === "ALL" || a.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [assets, search, categoryFilter]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);

    const formData = new FormData(e.currentTarget);

    try {
      if (uploadMode === "file") {
        // File upload mode
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const asset = await res.json();
          setAssets((prev) => [asset, ...prev]);
          setShowForm(false);
          toast("Asset uploaded", "success");
        } else {
          const err = await res.json();
          toast(err.error || "Upload failed", "error");
        }
      } else {
        // URL mode
        const data = {
          name: formData.get("name") as string,
          fileUrl: formData.get("fileUrl") as string,
          fileType: (formData.get("fileType") as string) || "glb",
          category: (formData.get("category") as string) || undefined,
          tags: ((formData.get("tags") as string) || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };

        const res = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          const asset = await res.json();
          setAssets((prev) => [asset, ...prev]);
          setShowForm(false);
          toast("Asset added to library", "success");
        } else {
          toast("Failed to add asset", "error");
        }
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setCreating(false);
    }
  }

  async function deleteAsset(id: string) {
    if (!confirm("Remove this asset from your library?")) return;

    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast("Asset removed", "success");
    } else {
      toast("Failed to remove asset", "error");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Asset Library</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage your 3D models and assets
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          + Add Asset
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets or tags..."
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        />
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {showForm && (
        <div className="p-5 rounded-xl border border-[var(--border)] mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="font-semibold">Add Asset</h3>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setUploadMode("file")}
                className={`px-3 py-1 ${uploadMode === "file" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""}`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("url")}
                className={`px-3 py-1 ${uploadMode === "url" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : ""}`}
              >
                From URL
              </button>
            </div>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  name="name"
                  required={uploadMode === "url"}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="e.g., Modern Sofa"
                />
              </div>
              {uploadMode === "file" ? (
                <div>
                  <label className="block text-sm font-medium mb-1">File</label>
                  <input
                    name="file"
                    type="file"
                    required
                    accept=".glb,.gltf,.obj,.fbx,.png,.jpg,.jpeg,.webp"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    File URL (GLTF/GLB)
                  </label>
                  <input
                    name="fileUrl"
                    type="url"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {uploadMode === "url" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    File Type
                  </label>
                  <select
                    name="fileType"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  >
                    <option value="glb">GLB</option>
                    <option value="gltf">GLTF</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <input
                  name="category"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="Furniture, Lighting..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  name="tags"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="modern, sofa, ikea"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 rounded-lg text-sm disabled:opacity-50"
              >
                {creating ? (uploadMode === "file" ? "Uploading..." : "Adding...") : (uploadMode === "file" ? "Upload" : "Add Asset")}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-1.5 rounded-lg text-sm border border-[var(--border)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {assets.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)]">
          <p className="text-4xl mb-4">🎨</p>
          <p className="font-semibold">No assets yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Add GLTF/GLB models to use in your room designs
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">No assets match your search</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="p-4 rounded-xl border border-[var(--border)] group"
            >
              <div className="h-32 rounded-lg bg-[var(--secondary)] flex items-center justify-center mb-3 relative">
                {asset.thumbnail ? (
                  <img
                    src={asset.thumbnail}
                    alt={asset.name}
                    className="h-full w-full object-cover rounded-lg"
                  />
                ) : (
                  <span className="text-3xl">📦</span>
                )}
                <button
                  onClick={() => deleteAsset(asset.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--background)] border border-[var(--border)] text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:text-[var(--destructive)]"
                >
                  ✕
                </button>
              </div>
              <h3 className="font-medium text-sm">{asset.name}</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {asset.fileType.toUpperCase()}
                {asset.category && ` · ${asset.category}`}
              </p>
              {asset.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {asset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => navigator.clipboard.writeText(asset.fileUrl).then(() => toast("URL copied", "info"))}
                className="mt-2 text-xs text-[var(--primary)] hover:underline"
              >
                Copy URL
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
