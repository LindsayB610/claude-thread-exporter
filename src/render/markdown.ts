import type { ClaudeMessage, RenderInput } from "../types.js";
import { metadataRows, preprocessAssistantMarkdown, snapshotTitle, textBlocks, visualBlocks } from "./shared.js";

export function renderMarkdown(input: RenderInput): string {
  const title = snapshotTitle(input.snapshot);
  const metadata = metadataRows(input)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const turns = (input.snapshot.chat_messages ?? []).map(renderMessage).filter(Boolean).join("\n\n");

  return [`# ${title}`, metadata, turns].filter(Boolean).join("\n\n").trimEnd() + "\n";
}

function renderMessage(message: ClaudeMessage): string {
  const blocks = [
    ...textBlocks(message).map((text) => (message.sender === "human" ? text : preprocessAssistantMarkdown(text))),
    ...visualBlocks(message).map((visual) => `[Visual artifact: ${visual.title}]`)
  ];

  if (blocks.length === 0) {
    return "";
  }

  const label = message.sender === "human" ? "You" : "Claude";
  return [`## ${label}`, blocks.join("\n\n")].join("\n\n");
}
