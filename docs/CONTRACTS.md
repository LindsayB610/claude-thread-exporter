# Contracts

This document captures implementation contracts that should stay stable while the extractor and renderer evolve.

## Compatibility Policy

Support for Claude shared-link page shapes should be intentionally conservative.

- A shared-link shape is supported only when it is covered by committed fixtures or an explicitly documented live-smoke result.
- Fixture-backed compatibility is the primary support contract.
- Live-link checks are confirmation, not the source of truth for long-term support claims.
- New shapes should not broaden support claims until they have regression coverage.

## Debug Artifact Contract

The planned CLI supports two local debug artifacts:

- `--debug-html`: the fetched raw shared-link HTML
- `--debug-json`: structured fetch and extract metadata

Debug artifacts are repair aids, not transcript destinations. They may be written during `--dry-run`.

## Privacy Contract

The core exporter should work only from Claude shared links that the user explicitly provides. It should not require Anthropic API credentials for normal export, and it should document Claude shared-chat limits clearly.
