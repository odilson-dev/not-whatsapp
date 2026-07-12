export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(value: number | string): string {
  const ms = typeof value === "string" ? Date.parse(value) : value;
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatRelative(ms: number | undefined): string {
  if (ms === undefined) return "never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ms);
}

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function isOnline(lastSeen: number | undefined): boolean {
  return lastSeen !== undefined && Date.now() - lastSeen <= ACTIVE_WINDOW_MS;
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
}
