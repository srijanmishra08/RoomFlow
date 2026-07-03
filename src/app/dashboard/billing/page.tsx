"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/Toast";

interface ClientInfo {
  id: string;
  user: { name: string; email: string };
}

interface ProjectInfo {
  id: string;
  title: string;
  clientId: string | null;
}

interface InvoiceItem {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  description: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  client: { user: { name: string; email: string } };
  project: { id: string; title: string } | null;
}

interface BillingData {
  invoices: Invoice[];
  clients: ClientInfo[];
  projects: ProjectInfo[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    invoiceCount: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-400 line-through",
};

function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BillingPage() {
  const { toast } = useToast();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: "", quantity: 1, rate: 0, amount: 0 },
  ]);
  const [tax, setTax] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/billing")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "ALL") return data.invoices;
    return data.invoices.filter((inv) => inv.status === statusFilter);
  }, [data, statusFilter]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const total = subtotal + tax;

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index].amount = updated[index].quantity * updated[index].rate;
      return updated;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !title || items.every((i) => !i.name)) {
      toast("Fill in client, title, and at least one item", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          projectId: projectId || null,
          title,
          items: items.filter((i) => i.name),
          tax,
          dueDate: dueDate || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        const inv = await res.json();
        setData((prev) =>
          prev
            ? {
                ...prev,
                invoices: [inv, ...prev.invoices],
                summary: {
                  ...prev.summary,
                  totalBilled: prev.summary.totalBilled + inv.total,
                  invoiceCount: prev.summary.invoiceCount + 1,
                },
              }
            : prev
        );
        setShowForm(false);
        resetForm();
        toast("Invoice created", "success");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to create invoice", "error");
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(invoiceId: string, status: string) {
    const res = await fetch("/api/billing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              invoices: prev.invoices.map((inv) =>
                inv.id === invoiceId ? updated : inv
              ),
            }
          : prev
      );
      toast(`Invoice marked as ${status.toLowerCase()}`, "success");
    }
  }

  function resetForm() {
    setClientId("");
    setProjectId("");
    setTitle("");
    setItems([{ name: "", quantity: 1, rate: 0, amount: 0 }]);
    setTax(0);
    setDueDate("");
    setNotes("");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton" />
        <div className="grid gap-4 sm:grid-cols-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Client Billing</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Create and manage invoices for your clients
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          + New Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Billed" value={formatCurrency(data.summary.totalBilled)} />
        <SummaryCard label="Paid" value={formatCurrency(data.summary.totalPaid)} color="text-emerald-600" />
        <SummaryCard label="Pending" value={formatCurrency(data.summary.totalPending)} color="text-amber-600" />
        <SummaryCard label="Invoices" value={String(data.summary.invoiceCount)} />
      </div>

      {/* Create Invoice Form */}
      {showForm && (
        <div className="p-5 rounded-xl border border-[var(--border)] mb-6">
          <h3 className="font-semibold mb-4">New Invoice</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Client *</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                >
                  <option value="">Select client</option>
                  {data.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user.name} ({c.user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Project (optional)</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                >
                  <option value="">No project</option>
                  {data.projects
                    .filter((p) => !clientId || p.clientId === clientId || !p.clientId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Invoice Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                  placeholder="e.g., Living Room Design - Phase 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium mb-2">Line Items</label>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                      placeholder="Item description"
                      className="col-span-5 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      min={1}
                      onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                      className="col-span-2 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm text-center"
                      placeholder="Qty"
                    />
                    <input
                      type="number"
                      value={item.rate || ""}
                      onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value) || 0)}
                      className="col-span-3 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                      placeholder={`Rate (\u20b9)`}
                    />
                    <span className="col-span-1 text-sm text-right">
                      {formatCurrency(item.quantity * item.rate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                      className="col-span-1 text-red-400 hover:text-red-600 text-sm"
                    >
                      {"\u00d7"}
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [...prev, { name: "", quantity: 1, rate: 0, amount: 0 }])
                }
                className="text-xs text-[var(--primary)] hover:underline mt-2"
              >
                + Add line item
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">{`Tax (\u20b9)`}</label>
                <input
                  type="number"
                  value={tax || ""}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
                />
              </div>
              <div className="text-right pt-4">
                <span className="text-sm text-[var(--muted-foreground)]">Subtotal: </span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="text-right pt-4">
                <span className="text-sm font-medium">Total: </span>
                <span className="text-lg font-bold">{formatCurrency(total)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm resize-none"
                placeholder="Payment terms, bank details, etc."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 rounded-lg text-sm disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Invoice"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-1.5 rounded-lg text-sm border border-[var(--border)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {["ALL", "DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              statusFilter === s
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            {s !== "ALL" && (
              <span className="ml-1 opacity-70">
                ({data.invoices.filter((inv) => inv.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {data.invoices.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)]">
          <p className="text-4xl mb-4">{"\U0001f4cb"}</p>
          <p className="font-semibold">No invoices yet</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create your first invoice to start billing clients
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">No invoices match this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              className="p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/30 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-[var(--muted-foreground)]">
                      {inv.number}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <h3 className="font-medium">{inv.title}</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {inv.client.user.name}
                    {inv.project && <> {"\u00b7"} {inv.project.title}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(inv.total, inv.currency)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                    {inv.dueDate && (
                      <> {"\u00b7"} Due {new Date(inv.dueDate).toLocaleDateString("en-IN")}</>
                    )}
                  </p>
                </div>
              </div>

              {/* Status actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                {inv.status === "DRAFT" && (
                  <>
                    <button
                      onClick={() => updateStatus(inv.id, "SENT")}
                      className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      Mark Sent
                    </button>
                    <button
                      onClick={() => updateStatus(inv.id, "CANCELLED")}
                      className="text-xs px-3 py-1 rounded-lg text-red-500 hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {inv.status === "SENT" && (
                  <>
                    <button
                      onClick={() => updateStatus(inv.id, "PAID")}
                      className="text-xs px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      Mark Paid
                    </button>
                    <button
                      onClick={() => updateStatus(inv.id, "OVERDUE")}
                      className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Mark Overdue
                    </button>
                  </>
                )}
                {inv.status === "OVERDUE" && (
                  <button
                    onClick={() => updateStatus(inv.id, "PAID")}
                    className="text-xs px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    Mark Paid
                  </button>
                )}
                {inv.status === "PAID" && inv.paidAt && (
                  <span className="text-xs text-emerald-600">
                    Paid on {new Date(inv.paidAt).toLocaleDateString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--border)]">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || ""}`}>{value}</p>
    </div>
  );
}
