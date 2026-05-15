# Release Checklist

Use this checklist before tagging or publishing a release candidate.

## Required Gates

- `npm test`
- `npm run check`
- `npm run build`
- `npm --cache /private/tmp/claude-exporter-npm-cache pack --dry-run`
- `npm audit --omit=dev`

## Fixture And Example Checks

- Regenerate Markdown and PDF examples from saved fixtures.
- Confirm examples folder contains only the README plus the two V1 example pairs.
- Run a public-safety scan over fixtures and examples for obvious private fields, credentials, and accidental local identifiers.

## Live Capture Check

- Try one live `--url` smoke with headed Playwright Chromium.
- If Claude/Cloudflare loops verification, document that result rather than treating it as a release blocker.
- Confirm the reliable `--snapshot` path still works.

## Release Notes

- State that live Claude URL capture is experimental.
- State that saved snapshot JSON is the reliable V1 path.
- Mention Playwright Chromium install guidance.
- Mention that Safari and normal Chrome sessions are separate from the Playwright profile.
