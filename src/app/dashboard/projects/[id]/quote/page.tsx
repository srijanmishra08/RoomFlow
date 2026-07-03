"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface QuoteItem {
  id?: string;
  itemType: "ROOM" | "PHASE" | "SERVICE";
  title: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
}

interface Quote {
  id: string;
  status: string;
  currency: string;
  total: number;
  items: QuoteItem[];
}

export default function ProjectQuotePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<number>(0);

  async function loadQuotes() {
    const res = await fetch(`/api/projects/${projectId}/quotes`);
    if (!res.ok) return;
    setQuotes(await res.json());
  }

  useEffect(() => {
    void loadQuotes();
  }, [projectId]);

  async function addLine() {
    if (!title.trim() || price <= 0) return;
    await fetch(`/api/projects/${projectId}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency: "INR",
        status: "DRAFT",
        items: [
          {
            itemType: "SERVICE",
            title: title.trim(),
            quantity: 1,
            unitPrice: price,
          },
        ],
      }),
    });
    setTitle("");
    setPrice(0);
    await loadQuotes();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotation</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Build room-wise, phase-wise, and custom service quotes.
          </p>
        </div>
        <Link href={`/dashboard/projects/${projectId}`} className="text-sm text-[var(--primary)] hover:underline">
          Back to project
        </Link>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Service / room / phase"
          className="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
        />
        <input
          value={price || ""}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="Amount"
          type="number"
          className="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)] text-sm"
        />
        <button onClick={addLine} className="px-3 py-1.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-sm">
          Create Draft Quote
        </button>
      </div>

      <div className="space-y-3">
        {quotes.length === 0 ? (
          <div className="text-sm text-[var(--muted-foreground)]">No quotes yet.</div>
        ) : (
          quotes.map((quote) => (
            <div key={quote.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{quote.currency} {quote.total.toLocaleString("en-IN")}</p>
                <span className="text-xs px-2 py-0.5 rounded border border-[var(--border)]">{quote.status}</span>
              </div>
              <div className="mt-2 text-xs text-[var(--muted-foreground)] space-y-1">
                {quote.items.map((item, index) => (
                  <div key={`${quote.id}-${index}`} className="flex justify-between">
                    <span>{item.title}</span>
                    <span>{quote.currency} {(item.amount || item.quantity * item.unitPrice).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
