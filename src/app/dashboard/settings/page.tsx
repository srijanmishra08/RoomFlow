"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";

interface Profile {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  designer: {
    studioName: string | null;
    phone: string | null;
    bio: string | null;
  } | null;
}

interface TeamMemberRow {
  id: string;
  role: "ASSISTANT" | "VIEWER";
  user: { id: string; name: string | null; email: string };
}

// Studio team management: add existing RoomFlow users by email as
// Assistant (edit) or Viewer (read-only).
function TeamSection() {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ASSISTANT" | "VIEWER">("ASSISTANT");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings/team")
      .then((res) => (res.ok ? res.json() : []))
      .then(setMembers)
      .catch(() => {});
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (res.ok) {
        setMembers((prev) => [...prev.filter((m) => m.id !== data.id), data]);
        setEmail("");
        toast("Team member added", "success");
      } else {
        toast(typeof data.error === "string" ? data.error : "Failed to add member", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(memberId: string) {
    const res = await fetch(`/api/settings/team?memberId=${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast("Member removed", "success");
    } else {
      toast("Failed to remove member", "error");
    }
  }

  return (
    <div className="p-6 rounded-xl border border-[var(--border)] mt-6">
      <h2 className="font-semibold mb-1">Team</h2>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">
        Assistants can edit your projects; Viewers get read-only access. The person must
        already have a RoomFlow account.
      </p>
      <form onSubmit={invite} className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@studio.com"
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "ASSISTANT" | "VIEWER")}
          className="px-2 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        >
          <option value="ASSISTANT">Assistant</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {members.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">No team members yet.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm p-2 rounded-lg border border-[var(--border)]">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.user.name || m.user.email}</p>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  m.role === "ASSISTANT" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {m.role === "ASSISTANT" ? "Assistant" : "Viewer"}
                </span>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    studioName: "",
    phone: "",
    bio: "",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setForm({
          name: data.name || "",
          studioName: data.designer?.studioName || "",
          phone: data.designer?.phone || "",
          bio: data.designer?.bio || "",
        });
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast("Profile updated successfully", "success");
      } else {
        const data = await res.json();
        toast(data.error || "Failed to update profile", "error");
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-48 skeleton" />
        <div className="h-4 w-32 skeleton" />
        <div className="space-y-3 mt-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Manage your account and studio profile
        </p>
      </div>

      {/* Profile Section */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="p-6 rounded-xl border border-[var(--border)]">
          <h2 className="font-semibold mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                value={profile?.email || ""}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] text-sm text-[var(--muted-foreground)]"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Email cannot be changed
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-[var(--border)]">
          <h2 className="font-semibold mb-4">Studio Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Studio Name</label>
              <input
                value={form.studioName}
                onChange={(e) => setForm({ ...form, studioName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                placeholder="Your design studio name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                placeholder="+91..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm resize-none"
                placeholder="Tell clients about your design studio..."
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {form.bio.length}/500 characters
              </p>
            </div>
          </div>
        </div>

        {/* Account info */}
        <div className="p-6 rounded-xl border border-[var(--border)]">
          <h2 className="font-semibold mb-2">Account</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Member since{" "}
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—"}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      <TeamSection />
    </div>
  );
}
