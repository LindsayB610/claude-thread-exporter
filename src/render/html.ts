import type { ClaudeMessage, RenderInput } from "../types.js";
import {
  escapeHtml,
  indent,
  isHttpUrl,
  linkifyPlainText,
  metadataRows,
  renderMarkdownText,
  snapshotTitle,
  textBlocks,
  visualBlocks
} from "./shared.js";

export function renderClaudeHtml(input: RenderInput): string {
  const title = snapshotTitle(input.snapshot);
  const messages = input.snapshot.chat_messages ?? [];
  const renderedMessages = messages.map(renderMessage).filter(Boolean).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
${indent(claudePdfCss(), 4)}
  </style>
</head>
<body>
  <main class="export-shell">
    <header class="export-header">
      <p class="export-brand">Claude Export</p>
      <h1 class="export-title">${escapeHtml(title)}</h1>
${indent(renderMetadataRows(input), 6)}
    </header>
    <section class="thread">
${indent(renderedMessages, 6)}
    </section>
  </main>
</body>
</html>
`;
}

function renderMetadataRows(input: RenderInput): string {
  return metadataRows(input)
    .map(
      ([label, value]) =>
        `<p class="export-meta"><span>${escapeHtml(label)}:</span> <span>${renderMetadataValue(value)}</span></p>`
    )
    .join("\n");
}

function renderMetadataValue(value: string): string {
  if (isHttpUrl(value)) {
    return `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
  }

  return linkifyPlainText(value);
}

function renderMessage(message: ClaudeMessage): string {
  const renderableBlocks = [
    ...textBlocks(message).map((text) => renderTextBlock(text, message.sender)),
    ...visualBlocks(message).map(renderVisual)
  ].filter(Boolean);

  if (renderableBlocks.length === 0) {
    return "";
  }

  if (message.sender === "human") {
    return `<article class="message message-human">
  <div class="user-bubble">${renderableBlocks.join("\n")}</div>
</article>`;
  }

  return `<article class="message message-assistant">
  <div class="assistant-prose">
${indent(renderableBlocks.join("\n"), 4)}
  </div>
</article>`;
}

function renderTextBlock(text: string, sender: string): string {
  if (sender === "human") {
    return `<div class="user-text">${renderPlainParagraphs(text)}</div>`;
  }

  return `<div class="markdown-body">${renderMarkdownText(text)}</div>`;
}

function renderPlainParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${linkifyPlainText(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("\n");
}

function renderVisual(visual: { title: string; svg: string }): string {
  return `<figure class="visual-artifact">
  <div class="visual-frame">${visual.svg}</div>
  <figcaption>${escapeHtml(visual.title)}</figcaption>
</figure>`;
}

export function claudePdfCss(): string {
  return `
:root {
  --bg: #fbfaf8;
  --text: #161513;
  --muted: #7f7a73;
  --bubble: #f0efed;
  --rule: #d6d0c8;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.export-shell {
  width: min(1040px, calc(100vw - 96px));
  margin: 0 auto;
  padding: 58px 0 80px;
}

.export-header {
  width: min(860px, 100%);
  margin: 0 auto 56px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--rule);
}

.export-brand {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.export-title {
  margin: 0 0 16px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 42px;
  line-height: 1.08;
  font-weight: 700;
  letter-spacing: 0;
}

.export-meta {
  display: flex;
  gap: 6px;
  margin: 5px 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.35;
}

.export-meta span:first-child {
  color: #5f5a53;
  font-weight: 650;
}

a {
  color: inherit;
  text-decoration-color: rgba(95, 90, 83, 0.55);
  text-underline-offset: 2px;
}

.thread {
  width: 100%;
}

.message {
  margin: 0 0 56px;
}

.message-human {
  display: flex;
  justify-content: flex-end;
}

.user-bubble {
  width: min(720px, 78%);
  background: var(--bubble);
  border-radius: 16px;
  padding: 20px 22px;
  font-size: 20px;
  line-height: 1.38;
  letter-spacing: 0;
  break-inside: avoid;
}

.user-bubble p {
  margin: 0 0 12px;
}

.user-bubble p:last-child {
  margin-bottom: 0;
}

.assistant-prose {
  width: min(860px, 100%);
  margin: 0 auto;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 22px;
  line-height: 1.42;
  letter-spacing: 0;
}

.markdown-body > *:first-child,
.markdown-body p:first-child {
  margin-top: 0;
}

.markdown-body p {
  margin: 0 0 18px;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 700;
  line-height: 1.18;
  margin: 30px 0 16px;
  break-after: avoid;
}

.markdown-body h2 {
  font-size: 28px;
}

.markdown-body h3 {
  font-size: 22px;
}

.markdown-body hr {
  border: 0;
  border-top: 1px solid var(--rule);
  margin: 34px 0;
}

.markdown-body ul,
.markdown-body ol {
  margin: 0 0 20px 28px;
  padding: 0;
}

.markdown-body li {
  margin: 8px 0;
}

.markdown-body strong {
  font-weight: 700;
}

.markdown-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78em;
  background: #efede9;
  border-radius: 4px;
  padding: 1px 4px;
}

.markdown-body pre {
  background: #efede9;
  border-radius: 10px;
  padding: 16px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.45;
}

.visual-artifact {
  margin: 24px 0 30px;
  break-inside: avoid;
}

.visual-frame {
  border: 1px solid var(--rule);
  border-radius: 14px;
  background: #f5f2ed;
  padding: 16px;
  overflow: hidden;
}

.visual-frame svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 520px;
}

.visual-artifact figcaption {
  margin-top: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  font-size: 13px;
  color: var(--muted);
}

@page {
  margin: 12mm 10mm 16mm;
}

@media print {
  body {
    background: #fbfaf8;
  }

  .export-shell {
    width: 100%;
    padding: 22px 0 48px;
  }

  .export-header {
    width: 84%;
    margin-bottom: 30px;
    padding-bottom: 18px;
  }

  .export-brand {
    font-size: 9.5px;
    margin-bottom: 7px;
  }

  .export-title {
    font-size: 26px;
    line-height: 1.12;
    margin-bottom: 10px;
  }

  .export-meta {
    display: block;
    font-size: 10.5px;
    line-height: 1.35;
    margin: 3px 0;
    overflow-wrap: anywhere;
  }

  .message {
    margin-bottom: 34px;
  }

  .user-bubble {
    width: 72%;
    font-size: 13.5px;
    border-radius: 12px;
    padding: 12px 14px;
  }

  .assistant-prose {
    width: 84%;
    font-size: 15.5px;
    line-height: 1.42;
  }

  .markdown-body h2 {
    font-size: 20px;
  }

  .markdown-body h3 {
    font-size: 16px;
  }

  .markdown-body p {
    margin-bottom: 12px;
  }

  .markdown-body hr {
    margin: 22px 0;
  }

  .visual-artifact {
    margin: 16px 0 22px;
  }

  .visual-frame {
    border-radius: 10px;
    padding: 10px;
  }

  .visual-frame svg {
    max-height: 360px;
  }
}
`.trim();
}
