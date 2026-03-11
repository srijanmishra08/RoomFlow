"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";

interface Plan {
  name: string;
  price: number;
  projects: number;
  rooms: number;
  assets: number;
}

interface BillingData {
  plan: string;
  plans: Record<string, Plan>;
  subscription: {
    plan: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
  };
  usage: {
    projects: number;
    rooms: number;
    assets: number;
  };
  limits: Plan;
}

export default function BillingPage() {
  const { toast } = useToast();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing")
      .then((res) => res.json())
      .then((data) => {
        setBilling(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleUpgrade(plan: string) {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", plan }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.success) {
        setBilling((prev) =>
          prev
            ? { ...prev, plan, subscription: { ...prev.subscription, plan } }
            : prev
        );
        toast(`Upgraded to ${plan}`, "success");
      } else {
        toast(data.error || "Failed to upgrade", "error");
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setUpgrading(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the billing period.")) return;

    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    if (res.ok) {
      setBilling((prev) =>
        prev
          ? { ...prev, subscription: { ...prev.subscription, cancelAtPeriodEnd: true } }
          : prev
      );
      toast("Subscription will be cancelled at period end", "info");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!billing) return null;

  const planOrder = ["FREE", "STARTER", "PRO", "STUDIO"];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Billing & Plans</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-8">
        Manage your subscription and see your usage
      </p>

      {/* Current usage */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <UsageCard
          label="Projects"
          used={billing.usage.projects}
          limit={billing.limits.projects}
        />
        <UsageCard
          label="Rooms"
          used={billing.usage.rooms}
          limit={billing.limits.rooms}
        />
        <UsageCard
          label="Assets"
          used={billing.usage.assets}
          limit={billing.limits.assets}
        />
      </div>

      {billing.subscription.cancelAtPeriodEnd && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm mb-6">
          Your subscription will be cancelled at the end of the billing period
          {billing.subscription.currentPeriodEnd && (
            <> on {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}</>
          )}.
        </div>
      )}

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {planOrder.map((key) => {
          const plan = billing.plans[key];
          if (!plan) return null;
          const isCurrent = billing.plan === key;
          const currentIdx = planOrder.indexOf(billing.plan);
          const planIdx = planOrder.indexOf(key);
          const isUpgrade = planIdx > currentIdx;

          return (
            <div
              key={key}
              className={`p-6 rounded-xl border ${
                isCurrent
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--border)]"
              }`}
            >
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold">
                  {plan.price === 0 ? "Free" : `₹${plan.price}`}
                </span>
                {plan.price > 0 && (
                  <span className="text-sm text-[var(--muted-foreground)]">/mo</span>
                )}
              </div>
              <ul className="space-y-2 text-sm mb-6">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  {plan.projects === -1 ? "Unlimited" : plan.projects} projects
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  {plan.rooms === -1 ? "Unlimited" : plan.rooms} rooms
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span>
                  {plan.assets === -1 ? "Unlimited" : plan.assets} assets
                </li>
                {key === "PRO" && (
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    Priority support
                  </li>
                )}
                {key === "STUDIO" && (
                  <>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500">✓</span>
                      Custom branding
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500">✓</span>
                      API access
                    </li>
                  </>
                )}
              </ul>
              {isCurrent ? (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full px-4 py-2 rounded-lg text-sm bg-[var(--secondary)] text-[var(--muted-foreground)]"
                  >
                    Current Plan
                  </button>
                  {key !== "FREE" && !billing.subscription.cancelAtPeriodEnd && (
                    <button
                      onClick={handleCancel}
                      className="w-full px-4 py-1.5 rounded-lg text-xs text-[var(--destructive)] border border-[var(--destructive)] hover:bg-red-50"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </div>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(key)}
                  disabled={!!upgrading}
                  className="w-full px-4 py-2 rounded-lg text-sm bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  {upgrading === key ? "Processing..." : "Upgrade"}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full px-4 py-2 rounded-lg text-sm bg-[var(--secondary)] text-[var(--muted-foreground)]"
                >
                  Downgrade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isNearLimit = !isUnlimited && pct >= 80;

  return (
    <div className="p-4 rounded-xl border border-[var(--border)]">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-2xl font-bold mt-1">
        {used}
        <span className="text-sm font-normal text-[var(--muted-foreground)]">
          {" "}/ {isUnlimited ? "∞" : limit}
        </span>
      </p>
      {!isUnlimited && (
        <div className="mt-2 h-1.5 rounded-full bg-[var(--secondary)]">
          <div
            className={`h-full rounded-full transition-all ${
              isNearLimit ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
