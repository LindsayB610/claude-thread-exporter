import type { ClaudeMessage } from "./types.js";

const timeZone = "America/Los_Angeles";

export function formatConversationRange(messages: ClaudeMessage[]): string {
  const timestamps = messages
    .map((message) => message.created_at)
    .filter((value): value is string => typeof value === "string")
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (timestamps.length === 0) {
    return "";
  }

  const start = timestamps[0]!;
  const end = timestamps[timestamps.length - 1]!;

  if (start.getTime() === end.getTime() || formatDateTime(start) === formatDateTime(end)) {
    return formatDateTime(start);
  }

  if (localDateKey(start) === localDateKey(end)) {
    return `${formatDate(start)}, ${formatTimeWithoutZone(start)} to ${formatTime(end)}`;
  }

  return `${formatDateTime(start)} to ${formatDateTime(end)}`;
}

export function formatDateTime(value: Date): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(value);
}

function formatTimeWithoutZone(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function localDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}
