# claude-thread-exporter

`claude-thread-exporter` is a local-first CLI for exporting Claude shared-link chats to readable Markdown, HTML, or PDF.

It is modeled after the companion ChatGPT exporter, with one important difference: live Claude capture currently requires a real Playwright-managed Chromium browser session.

## Status

The CLI can:

- try to open a Claude shared link in headed Playwright Chromium
- reuse a persistent Chromium profile after you log into Claude once
- capture Claude's shared-link snapshot JSON from the browser response
- export the snapshot to Markdown, HTML, or a Claude-styled PDF
- export from a saved snapshot JSON file for repeatable local work
- optionally write exports to a GitHub repository path with `GITHUB_TOKEN`

## Browser Reality

Live URL export is browser-assisted and experimental.

Claude's shared snapshot API is protected in a way that normal `fetch`/`curl` requests do not reliably pass. The CLI therefore opens a real Chromium window controlled by Playwright and waits for Claude's own page to load the snapshot JSON.

This worked in smoke tests, but it is not guaranteed. Claude/Cloudflare can also put Playwright Chromium into a verification loop. When that happens, repeated "I am human" clicks may not recover the session. The reliable V1 export path is `--snapshot-json` with a previously captured Claude snapshot JSON file.

This means:

- you may need to log into Claude inside the Playwright Chromium window on first use
- if you are not logged in, Claude will open its sign-in/auth flow in that Playwright Chromium window
- the CLI reuses that Playwright profile on later runs
- your normal Safari session cannot be reused
- your normal Chrome app profile is also separate from Playwright's managed profile
- the export still happens locally; no hosted backend or Anthropic API key is required

The default profile lives at:

```text
~/.claude-thread-exporter/chromium-profile
```

You can override it with `--profile-dir`.

## Usage

### Claude Share Link Path

Export a Claude shared link as Markdown:

```bash
claude-thread-exporter --claude-url "https://claude.ai/share/..."
```

Export as PDF:

```bash
claude-thread-exporter --claude-url "https://claude.ai/share/..." --format pdf
```

Choose an output path:

```bash
claude-thread-exporter --claude-url "https://claude.ai/share/..." --format pdf --out "./exports/thread.pdf"
```

Save the captured snapshot JSON while exporting:

```bash
claude-thread-exporter --claude-url "https://claude.ai/share/..." --save-snapshot "./fixtures/thread.snapshot.json"
```

`--url` is still supported as an alias for `--claude-url`.

### Claude Snapshot JSON Path

Export again from a saved snapshot without opening the browser:

```bash
claude-thread-exporter --snapshot-json "./fixtures/thread.snapshot.json" --source "https://claude.ai/share/..." --format pdf
```

Print Markdown or HTML to stdout:

```bash
claude-thread-exporter --snapshot-json "./fixtures/thread.snapshot.json" --format md --stdout
claude-thread-exporter --snapshot-json "./fixtures/thread.snapshot.json" --format html --stdout
```

`--snapshot` is still supported as an alias for `--snapshot-json`.

Write an export directly to GitHub:

```bash
GITHUB_TOKEN="..." claude-thread-exporter \
  --snapshot-json "./fixtures/thread.snapshot.json" \
  --format md \
  --repo "owner/repo" \
  --repo-path "exports/thread.md"
```

Overwrite an existing GitHub file:

```bash
GITHUB_TOKEN="..." claude-thread-exporter \
  --snapshot-json "./fixtures/thread.snapshot.json" \
  --repo "owner/repo" \
  --repo-path "exports/thread.md" \
  --force
```

## Options

```text
--claude-url <url>      Claude share link path: experimental capture with headed Playwright Chromium.
--url <url>             Alias for --claude-url.
--snapshot-json <path>  Claude snapshot JSON path: reliable export from captured snapshot JSON.
--snapshot <path>       Alias for --snapshot-json.
--source <url>          Source URL to show in exports when using the snapshot JSON path.
--format <format>       md, html, or pdf. Defaults to md.
--out <path>            Output path. Defaults to Downloads with a title-based filename.
--stdout                Print md/html to stdout instead of writing a file.
--repo <owner/name>     Also write the export to a GitHub repository.
--repo-path <path>      Repository-relative destination path for --repo.
--branch <branch>       GitHub branch to write to. Defaults to the repo default branch.
--profile-dir <path>    Chromium profile directory.
--timeout <ms>          Capture timeout. Defaults to 120000.
--save-snapshot <path>  Save the captured snapshot JSON for debugging or repeat exports.
--force                 Overwrite an explicit --out, --save-snapshot, or GitHub file if it exists.
-h, --help              Show help.
```

## Output

Markdown exports include:

- thread title
- source URL or snapshot id
- conversation date/range
- message count
- readable user and Claude turns

PDF exports use a Claude-inspired reading layout with:

- first-page title and metadata
- right-aligned user bubbles
- serif assistant prose
- page numbers
- best-effort rendering of complete SVG visual artifacts

Incomplete or internal Claude tool blocks are omitted from polished exports.

## GitHub Export

GitHub export uses the Contents API through Node's built-in `fetch`; it does not require the GitHub CLI.

- set `GITHUB_TOKEN` to a token with Contents write access for the target repo
- pass `--repo owner/name` and `--repo-path path/in/repo.md`
- use `--branch branch-name` only when writing to a non-default branch
- create the branch before running the exporter; the CLI does not create branches
- use `--force` to overwrite an existing GitHub file

`--repo-path` is explicit by design. The exporter writes exactly where you point it and refuses parent-directory traversal, absolute paths, repeated slashes, and directory paths.

## Current Limits

- Live capture depends on Claude's current shared-link browser behavior.
- The CLI supports shared links you explicitly provide; it does not export private, non-shared Claude chat state directly.
- Visual artifacts are best-effort. Complete SVG widgets can render; incomplete/stopped widgets cannot.
- Attached files are not expected to be included in Claude shared snapshots.
- If Claude changes the snapshot API shape, fixture-backed parser updates may be needed.
- GitHub export depends on `GITHUB_TOKEN`, repo access, and the target branch already existing.

## Troubleshooting

### Playwright Chromium is missing

If the CLI says it could not start Playwright Chromium, install the browser binary:

```bash
npx playwright install chromium
```

Then rerun the export command.

### Claude opens a sign-in or browser-check page

Complete the sign-in, authentication, or browser check inside the Playwright Chromium window the CLI opened. Then rerun the same command. The CLI will reuse the authenticated profile at `~/.claude-thread-exporter/chromium-profile` unless you pass a custom `--profile-dir`.

If Cloudflare verification loops, stop clicking. That Playwright session is not trusted enough to complete live capture right now. Use `--snapshot-json` with a captured snapshot JSON file, or try the live capture again later.

Safari and your normal Chrome app sessions do not carry over to Playwright Chromium.

### Snapshot capture times out

If Claude is logged in but the CLI still times out, rerun with a longer timeout:

```bash
claude-thread-exporter --claude-url "https://claude.ai/share/..." --timeout 180000
```

You can also save a successful capture for repeat exports:

```bash
claude-thread-exporter --claude-url "https://claude.ai/share/..." --save-snapshot "./thread.snapshot.json"
```

### GitHub export fails

If GitHub rejects the write, check that `GITHUB_TOKEN` is set, that the token has Contents write access, that the repository exists, and that any `--branch` you pass already exists.

## Development

Install dependencies:

```bash
npm install
```

If Chromium is not installed by Playwright automatically, install it once:

```bash
npx playwright install chromium
```

Run checks:

```bash
npm run check
npm test
```

Build:

```bash
npm run build
```

Run locally:

```bash
npm run dev -- --help
npm run dev -- --snapshot-json fixtures/shared-links/plain-text-kelp.snapshot.json --stdout
```

## Project Notes

- the implementation plan lives in [CLAUDE_EXPORT_PLAN.md](./CLAUDE_EXPORT_PLAN.md)
- live fixture candidates live in [fixtures/live-links.md](./fixtures/live-links.md)
- capture notes live in [docs/FIXTURE_CAPTURE.md](./docs/FIXTURE_CAPTURE.md)
- implementation contracts live in [docs/CONTRACTS.md](./docs/CONTRACTS.md)

## Privacy

- this tool is intended for shared links you explicitly provide
- local export is the default behavior
- no paid API or hosted backend is required for normal use
- think carefully before exporting sensitive conversations anywhere permanent

## Open Source

This project is public and released under the MIT License. See [LICENSE](./LICENSE).
