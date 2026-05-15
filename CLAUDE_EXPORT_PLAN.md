# Claude Thread Exporter Plan V1

## Project

- Proposed tool repo: `LindsayB610/claude-thread-exporter`
- Product shape: small open source CLI
- Primary job: turn a Claude shared-chat snapshot into readable Markdown

## Goal

Build a lightweight local-first exporter for short, intentional Claude chats.

This implementation should stay free for normal use:

- no required paid SaaS components
- no required paid API usage
- no required maintainer-hosted backend
- no dependency on Anthropic API credentials for normal export

Target user flow:

1. Finish a conversation in Claude
2. Create a shared link for that conversation
3. Run one CLI command with the shared-link URL
4. Get a readable Markdown or PDF export you control

## Product Boundary

This should remain deliberately narrow at first.

In scope:

- export one Claude shared-chat snapshot at a time
- support short, mostly text-first chats well
- preserve readable structure, especially code blocks
- support stdout, local-file, optional GitHub, and later PDF output
- keep normal usage free and local-first

Out of scope:

- guaranteed durability against future Claude page changes
- perfect fidelity for every Claude artifact type
- background sync or automatic export
- notebooks, indexing, embeddings, tagging, or search features
- export of private non-shared chat state

## Claude-Specific Product Facts

These points are based on Anthropic’s current public help documentation and should be treated as product assumptions until verified against live shared pages:

- shared chats are snapshots of messages sent before sharing
- messages sent after sharing are not automatically included unless the snapshot is updated and shared again
- shared snapshots can include artifacts
- attached files are **not** included in the shared snapshot
- MCP raw tool data remains hidden; only final visible output is shared
- Team and Enterprise sharing may be organization-limited rather than public

Sources:

- [Sharing and Unsharing Chats | Claude Help Center](https://support.claude.com/en/articles/10593882-sharing-and-unsharing-chats)
- [Manage project visibility and sharing | Claude Help Center](https://support.claude.com/en/articles/9519189-project-visibility-and-sharing)
- [What are artifacts and how do I use them? | Claude Help Center](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)

## Core Product Decisions

### Why Shared Links

For this product, the Claude shared-chat snapshot is the right source of truth because it is:

- user-controlled
- publicly viewable when intentionally shared
- snapshot-based
- available without requiring API access or account integration

This keeps the tool simple and avoids coupling the first version to Anthropic API auth or paid API usage.

### Default Output Policy

Default behavior should match the current ChatGPT exporter:

- save to a unique file in `Downloads`

Optional explicit behaviors:

- `--stdout` prints Markdown to Terminal
- `--out <path>` writes to a local file
- `--repo <owner/name>` and `--repo-path <path>` write to GitHub

The tool must never default to writing into its own source repo.

### Cost Constraint

The implementation must stay free for normal use.

That means:

- no required hosted service run by the maintainer
- no required database
- no paid queue/worker/serverless dependency
- no required Anthropic API key
- no paid OCR/parsing/AI API dependency

Acceptable optional dependencies:

- GitHub, only when the user explicitly opts into repo export
- a GitHub personal access token, only for that optional path

### Repo Strategy

Recommended repo:

- `LindsayB610/claude-thread-exporter`

Exported artifacts should live only where the user explicitly chooses.

### Open Source Posture

The tool should be public and OSS licensed.

Recommended:

- MIT License

First public release should include:

- `LICENSE`
- `README.md`
- privacy and limitation notes specific to Claude shared chats

## Success Criteria

The POC is successful if:

- one real Claude shared link can be fetched reliably
- extracted turns can be normalized into a stable internal model
- Markdown output is readable and useful for short text-heavy chats
- code blocks remain readable
- stdout mode works without side effects
- local file mode works with explicit paths
- parser failures are diagnosable when Claude’s shared page shape changes

The first release candidate is successful if:

- the local-only exporter path is reliable end to end
- fixture-based extractor, normalizer, and renderer tests are stable
- at least one manual live-link smoke test succeeds before release

GitHub write mode is valuable but not required for the first release candidate.
Claude-style PDF export is valuable but not required for the first release candidate.

## CLI Contract

### Command

```bash
claude-thread-exporter \
  --url "https://claude.ai/share/..." \
  --stdout
```

```bash
claude-thread-exporter \
  --url "https://claude.ai/share/..." \
  --out "./conversation-exports/2026-04-10-claude-chat.md"
```

```bash
claude-thread-exporter \
  --url "https://claude.ai/share/..." \
  --repo "LindsayB610/chat-exports" \
  --repo-path "conversation-exports/2026-04-10-claude-chat.md"
```

### Required Flag

- `--url`

### Optional Flags

- `--stdout`
- `--out <path>`
- `--repo <owner/name>`
- `--repo-path <path>`
- `--title <title>`
- `--branch <name>`
- `--dry-run`
- `--debug-html <path>`
- `--debug-json <path>`
- `--force`

### Flag Semantics

- With no destination flags, save to a unique file in `Downloads`
- `--stdout` prints Markdown to Terminal instead of only saving a file
- `--out` writes to a local file and does not also print to stdout unless `--stdout` is set
- `--repo` requires `--repo-path`
- `--repo-path` without `--repo` is an error
- `--dry-run` performs fetch, extract, normalize, and render, but performs no transcript-destination writes
- `--debug-html` and `--debug-json` may still write local debug artifacts during `--dry-run`
- `--force` allows overwrite behavior for explicit destinations

### Behavior Matrix

- `--url` only: save a unique Markdown file in `Downloads`
- `--url --stdout`: print Markdown to stdout
- `--url --out <path>`: write Markdown to local file only
- `--url --out <path> --stdout`: write local file and print Markdown to stdout
- `--url --dry-run`: print Markdown to stdout and perform no transcript-destination writes
- `--url --dry-run --out <path>`: print Markdown to stdout and do not write the transcript file
- `--url --dry-run --repo ... --repo-path ...`: print Markdown to stdout and do not call GitHub
- `--url --debug-html <path>`: write debug HTML and follow normal transcript output behavior
- `--url --debug-json <path>`: write debug JSON and follow normal transcript output behavior

### Path Validation

Use the same path rules as the ChatGPT exporter:

- local paths must not be empty
- directory-only paths are invalid
- reject parent-directory traversal like `..`
- validate before any network fetch

GitHub path rules:

- must be repository-relative
- must not begin with `/`
- must not contain backslashes
- must not contain repeated slashes
- must not contain `..`
- must not end with `/`

## Architecture

### 1. Fetcher

Responsibility:

- fetch Claude shared-chat HTML
- follow redirects
- capture final URL, status code, and debug-relevant metadata

Notes:

- start with standard HTTP fetch
- avoid browser automation at fetch time unless basic HTTP proves insufficient

### 2. Extractor

Responsibility:

- parse the Claude shared-chat page
- locate serialized conversation data
- return raw conversation-shaped data plus extraction metadata

Claude-specific notes:

- shared snapshots include visible conversation content
- artifacts may be present and may need separate handling
- files are not included, so file references should degrade gracefully
- MCP raw data should not be expected in the shared page

Risk:

- this is still the highest-risk module

### 3. Normalizer

Responsibility:

- convert raw Claude payload data into a stable internal transcript model

Must support:

- `user` turns
- `assistant` turns
- text blocks
- code blocks
- graceful placeholders for unsupported content
- optional attachment/artifact metadata when visible in shared output

### 4. Renderer

Responsibility:

- render normalized turns into readable Markdown

Requirements:

- preserve readable structure
- preserve code fences
- preserve heading/list/quote structure where recoverable
- keep output deterministic for golden tests

### 5. Local Writer

Responsibility:

- save to explicit local paths
- create parent directories
- refuse overwrite unless `--force`

### 6. GitHub Writer

Responsibility:

- create or update a file in a user-selected GitHub repo path

This should mirror the existing ChatGPT exporter design.

## Naming and Title Strategy

### Title Resolution

Priority:

1. explicit `--title`
2. extracted Claude chat title, if available
3. fallback generated title like `claude-chat-export`

### Slug Rules

- lowercase
- spaces become `-`
- collapse repeated separators
- trim punctuation-heavy edges

### Filename Pattern

- `<slug>-export.md`
- `<slug>-export-2.md` if needed for uniqueness

## Failure Modes

### 1. Claude shared-page shape changes

Mitigation:

- keep extractor isolated
- save debug HTML/JSON artifacts
- maintain fixture-driven tests

### 2. Unsupported artifacts or rich content

Mitigation:

- degrade clearly
- preserve useful metadata when possible
- do not invent unsupported content

### 3. Duplicate exports

Mitigation:

- unique default filenames in `Downloads`
- explicit overwrite behavior only via `--force`

### 4. GitHub write failure

Mitigation:

- clear user-facing errors
- do not mask successful local rendering when GitHub write fails

### 5. Privacy mistakes

Mitigation:

- document that shared chats are snapshots
- document that files are not included in the shared snapshot
- document that raw MCP data is not shared

## Testing Strategy

### Recommended Development Style

Use the same structure that worked for the ChatGPT exporter:

- isolated unit tests for arg parsing, fetcher, extractor, normalizer, renderer, writers
- fixture-based extractor tests
- golden Markdown tests
- integration tests for local export path

### Fixture Hygiene

Collect representative Claude shared-chat fixtures and sanitize them for public commit.

Fixture set should include:

- plain text chat
- code-heavy chat
- artifact-bearing chat
- malformed or missing-payload case

### Unit Tests

Need:

- argument validation tests
- extractor shape tests
- normalizer tests
- renderer tests
- local writer tests
- GitHub writer tests

### Integration Tests

Need:

- fixture HTML -> extract -> normalize -> render -> local file
- dry-run behavior
- stdout behavior

### Test Gates

Required:

- `npm test`
- `npm run check`

### Smoke Test

Before release:

- one real Claude shared link must export successfully

## Development Phases

### Phase 0: Repo Foundation

Set up:

- repo scaffold
- `README.md`
- `LICENSE`
- `.gitignore`
- TypeScript and test tooling
- `src/` and `test/` layout

Done when:

- repo can build, typecheck, and run tests

### Phase 1: CLI Contract

Build:

- arg parsing
- destination validation
- path validation
- dry-run/debug semantics

Done when:

- invalid flag combinations fail cleanly
- default save behavior works
- tests cover CLI contract

### Phase 2: Core Types and Contracts

Build:

- internal types for fetched/extracted/normalized/rendered data
- debug artifact contract
- compatibility notes for fixtures

Done when:

- extractor and renderer interfaces are explicit

### Phase 3: Pipeline Skeleton

Build:

- fetch -> extract -> normalize -> render -> emit
- dependency injection seams for tests

Done when:

- pipeline stages are wired and independently testable

### Phase 4: Fetcher and Debug Output

Build:

- shared-link fetcher
- final URL and status capture
- `--debug-html`
- `--debug-json`

Done when:

- one Claude shared link can be fetched
- parser-repair diagnostics are available

### Phase 5: Fixture Capture

Build:

- first representative sanitized Claude shared-page fixtures
- fixture catalog
- extractor target tests

Done when:

- extractor work can proceed without depending on live links every time

### Phase 6: Extractor V1

Build:

- payload discovery
- raw message extraction
- clear failure modes

Done when:

- extractor tests pass on saved fixtures
- at least one live Claude shared link is manually verified

### Phase 7: Normalizer V1

Build:

- raw payload -> stable turn/block model
- text/code support
- artifact placeholders where needed

Done when:

- normalized output is stable and renderer-ready

### Phase 8: Renderer V1

Build:

- readable Markdown renderer
- golden output tests

Done when:

- Markdown from text/code fixtures is deterministic and useful

### Phase 9: Local File Writer

Build:

- local write path
- overwrite/force behavior
- parent directory creation

Done when:

- explicit local writes are safe and tested

### Phase 10: Full Local Export Integration

Build:

- end-to-end local integration tests
- README usage documentation
- final local-path polish

Done when:

- local-only exporter path is reliable end to end

### Phase 11: Final Polish for `v1.0`

Build:

- user-facing copy cleanup
- README polish
- artifact filtering and cleanup
- final manual smoke test

Done when:

- the first local-only release candidate feels trustworthy and coherent

### Phase 12: GitHub Writer (`v1.1`)

Build:

- real GitHub file writer
- overwrite/update logic
- auth and conflict handling
- docs and smoke test

Done when:

- a real Claude export can be written into a GitHub repo path

### Phase 13: Claude-Style PDF Export (`v1.2`)

Build:

- HTML render layer inspired by Claude’s reading experience
- print-friendly PDF output
- footer pagination
- image/artifact display where possible

Done when:

- long text, code, and artifact-bearing Claude chats export cleanly as PDFs

### Phase 14: Lightweight Web Frontend (`v1.3`)

Build:

- small hosted frontend over the exporter engine
- Markdown/PDF choice
- download flow
- likely Netlify deployment

Done when:

- a non-technical user can paste a Claude shared link and download a result

## Auth Strategy

### Shared Link

No auth should be required for the core local exporter path.

### GitHub

GitHub export requires:

- user-provided `GITHUB_TOKEN`
- repo contents write access

### Anthropic API

Do not require Anthropic API auth for the core shared-link exporter.

If future features ever use the Anthropic API, keep that optional and clearly separate from the local shared-link workflow.

## README Commitments

The first public README should clearly explain:

- what the tool does
- that it works from Claude shared links
- that shared chats are snapshots
- that attached files are not included in the shared snapshot
- that raw MCP data is not included in the shared snapshot
- how to export to Markdown
- how to export to PDF later
- privacy limitations

## Tech Stack

Recommended baseline:

- TypeScript
- Node.js
- Vitest
- standard `fetch`
- optional Playwright later for PDF or DOM enrichment

## Recommendation Summary

Build the Claude exporter the same way the ChatGPT exporter succeeded:

- shared-link first
- local-first
- fixture-driven
- narrow scope
- clear failure modes

Key Claude-specific differences to plan around:

- shared snapshots may include artifacts
- files remain private and should not be expected in exports
- MCP tool-call internals are intentionally hidden
- extractor behavior must be grounded in real saved Claude share fixtures before later phases claim completeness
