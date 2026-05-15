import { Marked, type Tokens } from "marked";
import type { ClaudeContentBlock, ClaudeMessage, ClaudeSnapshot, RenderInput } from "../types.js";
import { formatConversationRange } from "../date-display.js";

const safeMarked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(token.text);
    }
  }
});

export function snapshotTitle(snapshot: ClaudeSnapshot): string {
  return snapshot.snapshot_name ?? "Claude export";
}

export function metadataRows(input: RenderInput): Array<[string, string]> {
  const messages = input.snapshot.chat_messages ?? [];
  return [
    ["Source", input.sourceUrl ?? input.snapshot.uuid ?? ""],
    ["Conversation", formatConversationRange(messages)],
    ["Messages", String(messages.length)]
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

export function renderMarkdownText(text: string): string {
  return safeMarked.parse(preprocessAssistantMarkdown(text)).toString();
}

export function preprocessAssistantMarkdown(text: string): string {
  let inFence = false;

  return text
    .replace(/\n---\n/g, "\n\n---\n\n")
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/u.test(line)) {
        inFence = !inFence;
        return line;
      }

      if (inFence) {
        return line;
      }

      return line.replace(/^(#{1,2})\s+/u, "### ");
    })
    .join("\n");
}

export function textBlocks(message: ClaudeMessage): string[] {
  return (message.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string" && block.text.trim())
    .map((block) => block.text!.trim());
}

export function visualBlocks(message: ClaudeMessage): Array<{ title: string; svg: string }> {
  return (message.content ?? [])
    .map(renderableVisual)
    .filter((value): value is { title: string; svg: string } => Boolean(value));
}

export function renderableVisual(block: ClaudeContentBlock): { title: string; svg: string } | null {
  if (block.type !== "tool_use" || block.name !== "visualize:show_widget") {
    return null;
  }

  const widgetCode = block.input?.widget_code;
  if (typeof widgetCode !== "string") {
    return null;
  }

  const svg = extractSvg(widgetCode);
  if (!svg) {
    return null;
  }

  return {
    title: typeof block.input?.title === "string" ? block.input.title.replaceAll("_", " ") : "visual artifact",
    svg
  };
}

export function extractSvg(value: string): string {
  const svg = value.match(/<svg[\s\S]*?<\/svg>/i)?.[0] ?? "";
  return sanitizeSvg(svg);
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/giu, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/giu, "")
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/giu, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/giu, "")
    .replace(/\s+(href|xlink:href)\s*=\s*"javascript:[^"]*"/giu, "")
    .replace(/\s+(href|xlink:href)\s*=\s*'javascript:[^']*'/giu, "");
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function linkifyPlainText(value: string): string {
  const urlPattern = /https?:\/\/[^\s<>"']+/gu;
  let html = "";
  let lastIndex = 0;

  for (const match of value.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const index = match.index ?? 0;
    const { url, trailing } = splitTrailingPunctuation(rawUrl);
    html += escapeHtml(value.slice(lastIndex, index));
    html += `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
    lastIndex = index + rawUrl.length;
  }

  html += escapeHtml(value.slice(lastIndex));
  return html;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function splitTrailingPunctuation(value: string): { url: string; trailing: string } {
  let url = value;
  let trailing = "";

  while (/[.,;:!?)]/u.test(url.at(-1) ?? "")) {
    trailing = `${url.at(-1)!}${trailing}`;
    url = url.slice(0, -1);
  }

  return { url, trailing };
}

export function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length > 0 ? `${prefix}${line}` : line))
    .join("\n");
}
