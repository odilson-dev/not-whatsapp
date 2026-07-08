export function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLastSeen(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const time = formatMessageTime(timestamp);

  if (date >= startOfToday) {
    return `last seen today at ${time}`;
  }

  if (date >= startOfYesterday) {
    return `last seen yesterday at ${time}`;
  }

  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `last seen ${day} at ${time}`;
}

export function formatConversationTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) {
    return formatMessageTime(timestamp);
  }

  if (date >= startOfYesterday) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}
