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
- emit to stdout for text formats or local files for all formats

## First Fetch Finding

The first live shared link returns a public React shell from `/share/:snapshotUuid`, but not the transcript payload. The app bundle points to `/api/chat_snapshots/:snapshotUuid?rendering_mode=messages&render_all_tools=true` for shared snapshots.

Direct `curl` and headless Chromium requests to that snapshot API currently receive a Cloudflare managed challenge. A headed Playwright run can load the shared page and capture the snapshot JSON after browser verification.

Extractor V1 targets the snapshot JSON shape first. Live URL export is browser-assisted but experimental: the CLI opens a persistent Playwright Chromium profile, waits for Claude's page to load `/api/chat_snapshots/...`, and exports the captured payload locally. Safari and normal Chrome application sessions are not reused.

The Playwright path has passed live smoke tests, but Claude/Cloudflare can also put the browser into a verification loop. When that happens, `--snapshot` is the reliable local export path until a non-Playwright capture strategy exists.
