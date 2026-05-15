# Architecture Notes

This directory is for implementation notes that are more tactical than the main plan.

Supporting documents:

- extractor assumptions about Claude shared-link page structure
- fixture capture notes
- compatibility and browser capture contracts
- artifact rendering behavior
- GitHub writer behavior notes
- release checklist notes

Build notes:

- `tsconfig.json` is for editor/typecheck coverage across `src/` and `test/`
- `tsconfig.build.json` is for production CLI output from `src/` only

Pipeline target:

- capture Claude shared-link snapshot JSON from headed Playwright Chromium when Claude/Cloudflare allows it
- support saved snapshot JSON as an explicit offline input
- render Markdown, HTML, and PDF from the snapshot shape
- emit to stdout for text formats, local files for all formats, or GitHub repository paths when requested

## First Fetch Finding

The first live shared link returns a public React shell from `/share/:snapshotUuid`, but not the transcript payload. The app bundle points to `/api/chat_snapshots/:snapshotUuid?rendering_mode=messages&render_all_tools=true` for shared snapshots.

Direct `curl` and headless Chromium requests to that snapshot API currently receive a Cloudflare managed challenge. A headed Playwright run can load the shared page and capture the snapshot JSON after browser verification.

Extractor V1 targets the snapshot JSON shape first. Live URL export is browser-assisted but experimental: the CLI opens a persistent Playwright Chromium profile, waits for Claude's page to load `/api/chat_snapshots/...`, and renders the captured payload to the requested explicit destination. Safari and normal Chrome application sessions are not reused.

The Playwright path has passed live smoke tests, but Claude/Cloudflare can also put the browser into a verification loop. When that happens, `--snapshot` is the reliable local export path until a non-Playwright capture strategy exists.

## GitHub Writer

The optional GitHub destination uses GitHub's Contents API through Node's built-in `fetch`.

Behavior:

- `--repo` must use `owner/name` form
- `--repo-path` must be a repository-relative file path
- `--branch` is optional and requires `--repo`
- `GITHUB_TOKEN` is required at write time
- existing files are refused unless `--force` is passed
- branches must already exist

The writer uploads the already-rendered export content. Markdown and HTML are uploaded as UTF-8 text. PDF exports are rendered to a temporary local PDF, read as bytes, uploaded as base64 content, and then the temporary file is removed.
