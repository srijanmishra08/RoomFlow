import { type ClassValue, clsx } from "clsx";

// Simple clsx-like utility (no twMerge dep needed)
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency: string = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function statusColor(status: string): string {
  switch (status) {
    case "FINALIZED":
      return "#22c55e"; // green
    case "IN_PROGRESS":
      return "#eab308"; // yellow
    case "PLANNED":
    default:
      return "#9ca3af"; // grey
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "FINALIZED":
      return "Finalized";
    case "IN_PROGRESS":
      return "In Progress";
    case "PLANNED":
    default:
      return "Planned";
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
