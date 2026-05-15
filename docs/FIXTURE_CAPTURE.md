# Fixture Capture Notes

## 2026-05-15: First Claude Shared Link

Live link:

- https://claude.ai/share/7b2442ee-2ffb-4f82-8852-291840cf5ca0

Prompt shape:

- short essay fixture candidate

Observed with plain HTTP fetch:

- `GET /share/7b2442ee-2ffb-4f82-8852-291840cf5ca0` returns `200 text/html`
- response is a small React app shell, about 6.8 KB
- the shell does not contain transcript text, `__NEXT_DATA__`, or an embedded conversation payload
- the page loads an app bundle from `assets-proxy.anthropic.com`

Observed from the app bundle:

- public snapshot route candidate:
  - `GET /api/chat_snapshots/:snapshotUuid?rendering_mode=messages&render_all_tools=true`
- organization-scoped route candidate when an active organization exists:
  - `GET /api/organizations/:orgUuid/chat_snapshots/:snapshotUuid?rendering_mode=messages&render_all_tools=true`
- normal logged-in conversation routes use `chat_conversations`, but shared links appear to use `chat_snapshots`

Observed with direct API fetch:

- `GET /api/chat_snapshots/7b2442ee-2ffb-4f82-8852-291840cf5ca0?rendering_mode=messages&render_all_tools=true` returns Cloudflare managed challenge HTML in `curl`
- browser-like headers still return a challenge
- fetching the public share shell with a cookie jar and replaying those cookies against the API still returns a challenge
- headless Chromium loads the share shell and bootstrap JSON, then receives a challenged `403` for the snapshot API
- headed Playwright can load the shared page and capture a clean `200 application/json` snapshot response after browser verification

Implementation implication:

- the first Claude shared-link fetcher cannot assume that plain `fetch()` can retrieve the snapshot JSON, even though the HTML shell is public
- URL-only, no-browser CLI export is not a V1 strategy
- extractor work should target the snapshot JSON shape captured from the browser network response
- V1 supports browser-assisted live capture with headed Playwright Chromium, but treats it as experimental because Claude/Cloudflare verification can loop
- saved snapshot JSON remains the reliable V1 input path

Fixture policy:

- raw downloaded HTML and challenged API responses are not committed
- `fixtures/shared-links/plain-text-kelp.snapshot.json` is a sanitized copy of the captured snapshot JSON
- UUIDs and creator fields were replaced with stable fixture values
- public prompt and response text were preserved for parser coverage

## 2026-05-15: Longer Claude Shared Link

Live link:

- https://claude.ai/share/f750dcac-e458-4228-9b5c-45e3b495aab4

Prompt shape:

- longer multi-turn worldbuilding conversation fixture candidate

Observed:

- headed Playwright captured `200 application/json` from `/api/chat_snapshots/f750dcac-e458-4228-9b5c-45e3b495aab4?rendering_mode=messages&render_all_tools=true`
- snapshot JSON is about 260 KB raw
- top-level shape matches the first fixture
- contains 24 messages alternating `human` and `assistant`
- content block types include:
  - `text`
  - `tool_use`
  - `tool_result`
- no attachments or files are present in the captured message metadata

Fixture policy:

- `fixtures/shared-links/underground-city.snapshot.json` is a sanitized copy of the captured snapshot JSON
- UUIDs and creator fields were replaced with stable fixture values
- public conversation text was preserved for parser coverage
- this fixture should drive graceful handling of `tool_use` and `tool_result` blocks
