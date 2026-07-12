import { formatLastSeen } from "@/lib/format-time";
import { useEffect, useState } from "react";
import { ONLINE_THRESHOLD_MS } from "./types";

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}

export function presenceLabel(
  lastSeen: number | undefined,
  now: number,
): string {
  if (lastSeen === undefined) {
    return "";
  }
  if (now - lastSeen < ONLINE_THRESHOLD_MS) {
    return "online";
  }
  return formatLastSeen(lastSeen);
}

export function formatDaySeparator(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, yesterday)) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export const MENTION_QUERY_REGEX = /(?:^|\s)@([^\s@]*)$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits text into plain strings and highlighted @mention tokens. */
export function renderTextWithMentions(
  text: string,
  mentionNames: string[],
): (string | { mention: string })[] {
  if (mentionNames.length === 0) {
    return [text];
  }
  const pattern = new RegExp(
    `@(?:${mentionNames.map(escapeRegExp).join("|")})`,
    "g",
  );
  const parts: (string | { mention: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ mention: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
