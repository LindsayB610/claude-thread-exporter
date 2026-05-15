# claude-thread-exporter

`claude-thread-exporter` is a planned local-first CLI for exporting Claude shared-link chats to readable Markdown.

It is modeled after the companion ChatGPT exporter, but the Claude extractor will be fixture-driven because Claude shared pages may expose conversation and artifact data differently.

## Status

This repository currently contains the project scaffold, implementation plan, and first live shared-link fixture candidate.

The exporter implementation is intentionally pending live fixture capture and parser validation.

## Planned Usage

```bash
claude-thread-exporter --url "https://claude.ai/share/..."
```

By default, the planned CLI will save a unique Markdown export to your `Downloads` folder.

Common planned options:

```bash
claude-thread-exporter --url "https://claude.ai/share/..." --stdout
claude-thread-exporter --url "https://claude.ai/share/..." --out "./conversation-exports/claude-chat.md"
claude-thread-exporter --url "https://claude.ai/share/..." --repo "owner/repo" --repo-path "exports/claude-chat.md"
```

## What It Will Do

- fetch one Claude shared-chat snapshot at a time
- preserve readable user and assistant turns
- keep text and code blocks readable
- represent visible artifacts explicitly, even when full fidelity is not possible
- save locally by default
- support stdout and explicit local file paths
- support opt-in GitHub export in a later phase

## Current Limits

- the parser depends on Claude shared-link page structure
- attached files are not expected to be included in Claude shared snapshots
- raw MCP tool data is not expected to be included in Claude shared snapshots
- artifact support will be best-effort and fixture-driven
- this project does not export private, non-shared Claude chat state

## Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run check
npm test
```

Run the placeholder CLI:

```bash
npm run dev -- --help
```

## Project Notes

- the implementation plan lives in [CLAUDE_EXPORT_PLAN.md](./CLAUDE_EXPORT_PLAN.md)
- live fixture candidates live in [fixtures/live-links.md](./fixtures/live-links.md)
- implementation contracts live in [docs/CONTRACTS.md](./docs/CONTRACTS.md)

## Privacy

- this tool is intended for shared links you explicitly provide
- local export is the default planned behavior
- no paid API or hosted backend should be required for normal use
- think carefully before exporting sensitive conversations anywhere permanent

## Open Source

This project is public and released under the MIT License. See [LICENSE](./LICENSE).
