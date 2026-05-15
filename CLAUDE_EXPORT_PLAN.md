# Claude Thread Exporter Plan V3

## Project

- Repo: `LindsayB610/claude-thread-exporter`
- Product shape: small open source CLI
- Primary job: turn a Claude shared-chat snapshot into readable Markdown, HTML, or PDF
- Current reliable implementation strategy: saved snapshot JSON -> local or GitHub Markdown/HTML/PDF
- Current experimental implementation strategy: browser-assisted live capture with Playwright Chromium

## Phase Dashboard

| Phase | Focus | Status |
| --- | --- | --- |
| 0 | Repo foundation | Complete |
| 1 | Claude fixture discovery | Complete |
| 2 | Browser-assisted live capture decision | Implemented, experimental |
| 3 | CLI contract and validation | Complete for V1 |
| 4 | Snapshot types and parsing | Complete for V1 |
| 5 | Markdown renderer | Complete for V1 |
| 6 | HTML/PDF renderer | Complete for V1 |
| 7 | Local output and CLI execution | Complete for V1 |
| 8 | User-facing error copy | Complete for known failures |
| 9 | Examples and docs | Complete for V1 |
| 10 | Release candidate hardening | Complete for RC1 |
| 11 | GitHub writer | Complete |
| 12 | Web frontend | Not started |

## Current Reality

The first assumption was that a Claude shared link might be fetchable with ordinary HTTP. Live validation showed that is not reliable.

Observed behavior:

- `GET /share/:snapshotUuid` returns the Claude React shell, not the transcript payload.
- The browser app fetches the real payload from `/api/chat_snapshots/:snapshotUuid?rendering_mode=messages&render_all_tools=true`.
- Direct `curl`, browser-ish HTTP headers, cookie-jar replay, and headless Chromium hit Cloudflare managed challenge behavior.
- Headed Playwright Chromium can sometimes load the shared page and capture the snapshot JSON response.
- Claude/Cloudflare can also put Playwright Chromium into a verification loop that repeated human clicks do not resolve.

So V1 is not a pure URL-fetching CLI. The reliable V1 core is:

1. Accept Claude snapshot JSON.
2. Render Markdown, HTML, or PDF locally or to an explicit GitHub path from that snapshot.

The experimental live URL path is:

1. Open the Claude shared link in a real Playwright-managed Chromium window.
2. Reuse a persistent Chromium profile so the user can log into Claude once.
3. Wait for Claude’s own page to load the snapshot JSON.
4. Render Markdown, HTML, or PDF locally or to an explicit GitHub path from that snapshot if capture succeeds.

Safari cannot be reused for this flow. Normal Chrome app sessions are also separate. The CLI owns its Playwright Chromium profile at:

```text
~/.claude-thread-exporter/chromium-profile
```

## Goal

Build a lightweight local-first exporter for intentional Claude shared chats.

The implementation should stay free for normal use:

- no required paid SaaS components
- no required paid API usage
- no required maintainer-hosted backend
- no dependency on Anthropic API credentials for normal export

Target user flow:

1. Finish a conversation in Claude.
2. Create a shared link.
3. Run one CLI command with the shared-link URL.
4. If needed, log into Claude inside the Playwright Chromium window.
5. Get a readable Markdown, HTML, or PDF export locally, or at an explicit GitHub repo path.

## Product Boundary

In scope for V1:

- export one Claude shared-chat snapshot at a time
- support experimental URL capture via headed Playwright Chromium
- support saved snapshot JSON as an offline input
- support Markdown, HTML, and Claude-style PDF output
- support stdout for Markdown/HTML
- support local file output
- support optional GitHub repository output
- keep normal usage free and local-first
- provide clear errors for missing Chromium, auth pages, browser checks, and timeouts

Out of scope for V1:

- pure HTTP shared-link fetching
- guaranteed durability against future Claude page changes
- perfect fidelity for every Claude artifact type
- background sync or automatic export
- notebooks, indexing, embeddings, tagging, or search features
- export of private non-shared chat state
- web frontend

## Claude-Specific Product Facts

These are current product assumptions and should stay documented:

- shared chats are snapshots of messages sent before sharing
- messages sent after sharing are not automatically included unless the snapshot is updated and shared again
- shared snapshots can include artifacts
- attached files are not expected to be included in the shared snapshot
- raw hidden tool/MCP data is not the product target; visible output is
- Team and Enterprise sharing may be organization-limited rather than public

Sources:

- [Sharing and Unsharing Chats | Claude Help Center](https://support.claude.com/en/articles/10593882-sharing-and-unsharing-chats)
- [Manage project visibility and sharing | Claude Help Center](https://support.claude.com/en/articles/9519189-project-visibility-and-sharing)
- [What are artifacts and how do I use them? | Claude Help Center](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)

## Implemented CLI Contract

```bash
claude-thread-exporter --claude-url "https://claude.ai/share/..."
claude-thread-exporter --claude-url "https://claude.ai/share/..." --format pdf
claude-thread-exporter --snapshot-json ./snapshot.json --source "https://claude.ai/share/..." --format pdf
```

Implemented options:

- `--claude-url <url>`: Claude share link path; experimental capture of a Claude shared link with headed Playwright Chromium
- `--url <url>`: alias for `--claude-url`
- `--snapshot-json <path>`: Claude snapshot JSON path; export from saved Claude snapshot JSON
- `--snapshot <path>`: alias for `--snapshot-json`
- `--source <url>`: source URL to show in exports when using the snapshot JSON path
- `--format <format>`: `md`, `html`, or `pdf`; defaults to `md`
- `--out <path>`: write output to a local path
- `--stdout`: print Markdown/HTML to stdout
- `--profile-dir <path>`: custom Playwright Chromium profile directory
- `--timeout <ms>`: capture timeout; defaults to `120000`
- `--save-snapshot <path>`: save captured snapshot JSON
- `--force`: overwrite an explicit `--out`, `--save-snapshot`, or GitHub file if it exists
- `--repo <owner/name>`: write the rendered export to a GitHub repository
- `--repo-path <path>`: repository-relative path to write when using `--repo`
- `--branch <branch>`: optional target branch for `--repo`; branch must already exist
- `-h`, `--help`: show help

Not implemented yet:

- `--dry-run`
- `--debug-html`
- `--debug-json`
- `--title`

## Architecture

### 1. Browser Capture

Status: implemented but experimental.

Responsibility:

- open Claude shared link in headed Playwright Chromium
- use persistent profile for auth reuse
- wait for `/api/chat_snapshots/...` response
- parse captured JSON into a Claude snapshot object
- classify user-facing capture failures
- treat looping verification as a live-capture blocker, not user error

Important files:

- `src/capture.ts`
- `src/snapshot.ts`
- `docs/FIXTURE_CAPTURE.md`

### 2. Snapshot Input

Status: complete for V1.

Responsibility:

- parse saved Claude snapshot JSON
- support direct snapshot payloads and simple wrapper objects
- make fixture-based development possible without live browser runs

Important files:

- `src/snapshot.ts`
- `fixtures/shared-links/*.snapshot.json`

### 3. Rendering

Status: complete for V1.

Responsibility:

- render readable Markdown
- render Claude-style HTML
- render PDF from HTML through Playwright
- include title, source, conversation date/range, and message count
- hyperlink source URLs and plain URLs in PDF/HTML output
- render complete SVG visual artifacts where recoverable
- omit incomplete/internal tool blocks from polished exports

Important files:

- `src/render/markdown.ts`
- `src/render/html.ts`
- `src/render/pdf.ts`
- `src/render/shared.ts`

### 4. Local Output

Status: complete for V1.

Responsibility:

- write explicit `--out` paths
- create parent directories
- default to unique Downloads filename when no output path is supplied
- support stdout for Markdown/HTML

Overwrite behavior:

- explicit outputs refuse to overwrite existing files by default
- `--force` permits overwrite for `--out` and `--save-snapshot`
- GitHub outputs refuse to overwrite existing files unless `--force` is passed

Important files:

- `src/cli.ts`
- `src/output-path.ts`

### 5. GitHub Writer

Status: complete.

Responsibility:

- optional GitHub file writer
- mirror the ChatGPT exporter’s explicit repo/path behavior
- use `GITHUB_TOKEN`
- refuse overwrites unless `--force` is passed
- support Markdown, HTML, and PDF GitHub writes

Important files:

- `src/github.ts`
- `src/cli.ts`
- `docs/CONTRACTS.md`

### 6. Web Frontend

Status: not started.

Responsibility:

- optional later non-technical paste-link frontend
- must clearly document whether any conversation data touches hosted infrastructure

Target version: later than CLI release.

## Testing Strategy

We are keeping the build in “TDD vibes” mode:

1. add or adjust the smallest useful test
2. implement narrowly
3. run `npm test`
4. run `npm run check`
5. run `npm run build` for CLI-affecting changes
6. update docs only after behavior is true

Current automated coverage:

- package export sanity
- CLI arg parsing and validation
- Claude URL validation
- PDF/stdout validation
- explicit output path validation
- snapshot parsing for direct, wrapped, and real fixture payloads
- unsupported and malformed snapshot rejection
- browser snapshot response wait/cancel cleanup
- renderer metadata and link behavior
- Markdown code fence preservation while demoting assistant headings
- Markdown visual placeholders and raw tool-block omission
- HTML/PDF header shape
- HTML/PDF assistant Markdown links
- HTML/PDF real fixture SVG rendering and raw tool-block omission
- HTML/PDF raw assistant HTML escaping
- HTML/PDF SVG widget sanitization
- default output path uniqueness
- explicit CLI local output with parent directory creation
- CLI overwrite refusal and `--force`
- CLI HTML stdout output
- GitHub repo/path/branch argument validation
- GitHub token requirement
- GitHub create-file path
- GitHub overwrite refusal and `--force` SHA update
- GitHub API failure guidance
- GitHub non-file path rejection
- missing Chromium error copy
- auth-page/browser-session guidance copy
- browser verification and Cloudflare loop guidance copy
- generic snapshot timeout guidance copy

Current test gates:

- `npm test`
- `npm run check`
- `npm run build`

Manual smoke coverage performed:

- compiled CLI exports from saved snapshot fixtures
- compiled CLI renders PDF from saved snapshot fixture
- compiled CLI PDF smoke passed after Phase 6 renderer hardening
- examples regenerated through the built CLI
- V1 fixtures/examples passed a public-safety scan for obvious private fields and credentials
- live URL smoke succeeded once against the kelp Claude share link with Playwright Chromium
- later live URL smoke hit a Claude/Cloudflare verification loop, proving the Claude share link path is not release-reliable

## Fixtures

Committed public-safe fixtures:

- `fixtures/shared-links/plain-text-kelp.snapshot.json`
- `fixtures/shared-links/underground-city.snapshot.json`
- `fixtures/shared-links/wrapped-minimal.snapshot.json`
- `fixtures/shared-links/unsupported-shape.snapshot.json`
- `fixtures/shared-links/malformed.snapshot.json`
- `fixtures/shared-links/code-block.snapshot.json`

Current fixture coverage:

- short essay-style text conversation
- longer multi-turn conversation
- Claude interactive question blocks
- visual widget/tool blocks
- complete SVG visual artifacts
- incomplete/stopped visual artifacts
- wrapped snapshot payload discovery
- unsupported-shape rejection
- malformed JSON rejection
- code fence preservation in Markdown rendering

Still useful to add later:

- code-heavy Claude conversation

## Examples

The examples folder now mirrors the ChatGPT exporter shape:

- `examples/kelp-forests.md`
- `examples/kelp-forests.pdf`
- `examples/underground-city.md`
- `examples/underground-city.pdf`

These are generated through the real CLI from saved snapshot fixtures.

## Failure Modes

### Missing Playwright Chromium

Mitigation:

- emit a specific error
- tell the user to run `npx playwright install chromium`

Status: implemented and tested.

### User Is Not Logged Into Claude

Expected behavior:

- Playwright Chromium opens Claude auth/sign-in flow
- user completes auth in that window
- user reruns the command
- CLI reuses the authenticated profile

Mitigation:

- timeout error inspects final page URL/title
- auth-page guidance tells the user Safari and normal Chrome sessions do not carry over

Status: implemented and tested.

### Browser Check / Cloudflare Challenge

Mitigation:

- tell the user to complete the browser check inside Playwright Chromium
- if verification loops, tell the user live capture is blocked and to use `--snapshot-json`
- reuse the same profile afterward when verification succeeds

Status: implemented, but live capture remains experimental.

### Claude Snapshot Shape Changes

Mitigation:

- keep snapshot parsing isolated
- rely on committed fixtures
- support `--save-snapshot` for repair/debug
- add regression fixtures before broadening support claims

Status: partially implemented.

### Unsupported Or Incomplete Artifacts

Mitigation:

- render complete SVG widgets when available
- omit incomplete/internal tool blocks from polished exports
- avoid alarming “omitted block” notes in user-facing PDFs

Status: implemented for observed fixtures.

### Duplicate / Overwrite Behavior

Mitigation:

- unique default filenames in Downloads
- explicit overwrite behavior is available with `--force`
- GitHub overwrite behavior also requires `--force`

Status: implemented for V1 local and GitHub outputs.

## Development Phases

### Phase 0: Repo Foundation

Status: complete.

Completed:

- public repo scaffold
- MIT license
- TypeScript, Vitest, build script, package metadata
- `src/`, `test/`, `docs/`, `examples/`, and `fixtures/` layout
- public GitHub repo created and initial scaffold pushed
- baseline `npm test` and `npm run check`

### Phase 1: Claude Fixture Discovery Spike

Status: complete.

Completed:

- inspected real Claude shared links
- proved plain HTTP/direct API fetch is not reliable
- proved headed Playwright Chromium can capture snapshot JSON
- documented findings in architecture and fixture docs
- captured and sanitized two public-safe snapshot fixtures

### Phase 2: Browser-Assisted Capture Decision

Status: implemented but not release-reliable.

Completed:

- chose persistent Playwright Chromium as V1 live URL strategy
- documented Safari/normal Chrome session limitation
- added `--profile-dir`
- added clear capture logging
- added `--save-snapshot`
- live smoke test passed once
- later live smoke hit looping Claude/Cloudflare verification

Decision:

- keep the Claude share link path as experimental
- treat the Claude snapshot JSON path as the reliable V1 path

### Phase 3: CLI Contract And Argument Validation

Status: complete for V1.

Completed:

- `parseArgs()`
- Claude share URL validation
- two named Claude input paths: link and snapshot JSON
- `--url`
- `--claude-url`
- `--snapshot`
- `--snapshot-json`
- `--source`
- `--format md|html|pdf`
- `--out`
- `--stdout`
- `--profile-dir`
- `--timeout`
- `--save-snapshot`
- help text
- `--force`
- `--repo`
- `--repo-path`
- `--branch`
- tests for implemented validation

Pending:

- `--dry-run`
- `--debug-html`
- `--debug-json`
- `--title`

### Phase 4: Snapshot Types And Parsing

Status: complete for V1.

Completed:

- Claude snapshot/message/content types
- saved snapshot JSON parser
- wrapped payload discovery
- fixture-backed snapshot development path
- malformed snapshot negative fixture
- unsupported-shape negative fixture
- tests for direct, wrapped, unsupported, and malformed snapshot inputs

### Phase 5: Markdown Renderer

Status: complete for V1.

Completed:

- Markdown title and metadata
- user/Claude turn headings
- assistant heading demotion so export title remains the only H1
- visual artifact placeholders in Markdown
- deterministic output from snapshot fixtures
- golden Markdown snapshot-style test for code fixture
- code fence preservation while demoting headings outside fences
- real long fixture test proving raw tool blocks do not leak into Markdown

### Phase 6: HTML/PDF Renderer

Status: complete for V1.

Completed:

- Claude-inspired PDF layout
- first-page H1 and metadata
- source link hyperlinking
- plain URL linkification in user text
- Markdown links in assistant output
- page footer
- user bubbles and assistant prose styling
- complete SVG visual artifact rendering
- removed internal omitted-block notes
- raw assistant HTML is escaped before HTML/PDF rendering
- SVG visual artifacts are sanitized before HTML/PDF rendering

Release posture:

- PDF output is release-grade for the observed V1 fixture set.
- Future visual regression tests would be useful maintenance tooling, not a Phase 6 blocker.

### Phase 7: Local Output And CLI Execution

Status: complete for V1.

Completed:

- explicit local output path
- parent directory creation
- default unique Downloads path
- stdout for Markdown/HTML
- PDF file output
- overwrite refusal for explicit files
- `--force` overwrite for explicit files
- compiled CLI smoke tests from fixtures
- tests for default output path uniqueness
- CLI integration tests using temp directories

### Phase 8: User-Facing Error Copy

Status: complete for current known failure modes.

Completed:

- missing Chromium error with install command
- auth-page guidance
- browser-check guidance
- timeout guidance
- README troubleshooting section
- tests for key error copy
- regression tests for known smoke-test failures

### Phase 9: Examples And Docs

Status: complete for V1.

Completed:

- README updated to real behavior
- examples folder leaned down to ChatGPT-style shape
- docs updated for browser capture contract
- fixture capture notes added
- current examples generated through real CLI
- examples regenerated through built CLI after Phase 9 review
- final public-safety fixture review completed for V1 examples

### Phase 10: Release Candidate Hardening

Status: complete for RC1.

Completed:

- release checklist added in `docs/RELEASE_CHECKLIST.md`
- package metadata includes repository, bugs, homepage, and keywords
- release gates passed: test, typecheck, build, pack dry-run, production audit
- final live URL smoke attempted; Claude/Cloudflare showed browser verification loop, matching the documented experimental-path limitation
- current release-candidate work committed and pushed to `main`
- RC marker/tag `v0.1.0-rc.1` created and pushed

Deferred:

- add a real code-heavy Claude fixture when one is available; the synthetic code-fence fixture covers Markdown code preservation for RC1

### Phase 11: GitHub Writer

Status: complete.

Completed:

- `--repo owner/name`
- `--repo-path path/in/repo.md`
- `--branch branch-name`
- `GITHUB_TOKEN`-backed GitHub Contents API writer
- exact repository-relative path behavior
- overwrite protection by default
- `--force` overwrite behavior for existing GitHub files
- Markdown and HTML GitHub output
- PDF GitHub output via temporary local render and binary upload
- README usage and troubleshooting notes
- architecture and contract documentation
- tests for argument validation, token requirement, create, overwrite refusal, forced update, and API failure guidance
- tests for auth/repo-access errors and non-file GitHub paths

Review:

- implementation is scoped to explicit destinations only
- branches and repositories are not created by the CLI
- all network behavior is covered through mocked `fetch`; tests do not call GitHub

### Phase 12: Web Frontend

Status: not started.

Target later version: after CLI stabilizes.

## README Commitments

README should clearly explain:

- what the tool does
- that live URL export uses Playwright Chromium
- that Safari and normal Chrome sessions cannot be reused
- how to install Playwright Chromium if missing
- how to export to Markdown, HTML, and PDF
- how to use saved snapshots
- how to write to GitHub with `GITHUB_TOKEN`
- that shared chats are snapshots
- that attached files are not expected in snapshots
- privacy limitations
- troubleshooting for auth/browser checks

Status: complete for current behavior.

## Recommendation Summary

The exporter is now a working browser-assisted local CLI, not just a parser plan.

Keep the next work boring and test-led:

- keep regression fixtures current
- add one code-heavy fixture
- begin Phase 12 only if a web frontend is still worth the complexity
