# Contracts

This document captures implementation contracts that should stay stable while the extractor and renderer evolve.

## Compatibility Policy

Support for Claude shared-link page shapes should be intentionally conservative.

- A shared-link shape is supported only when it is covered by committed fixtures or an explicitly documented live-smoke result.
- Fixture-backed compatibility is the primary support contract.
- Live-link checks are confirmation, not the source of truth for long-term support claims.
- New shapes should not broaden support claims until they have regression coverage.

## Browser Capture Contract

Live Claude URL capture is browser-assisted and experimental.

- The CLI opens headed Playwright Chromium.
- The user may need to log into Claude inside that Chromium profile once.
- Safari and normal Chrome app sessions are not reused.
- The supported live signal is Claude's browser-loaded `/api/chat_snapshots/...` JSON response.
- A saved snapshot JSON file is a supported offline input for repeat exports and tests.
- If Claude/Cloudflare loops verification in Playwright Chromium, the live URL path is considered blocked rather than user-error.

Snapshot artifacts are repair aids and may also be used as explicit export inputs via `--snapshot`.

## Privacy Contract

The core exporter should work only from Claude shared links or snapshot files that the user explicitly provides. It should not require Anthropic API credentials for normal export, and it should document Claude shared-chat limits clearly.
