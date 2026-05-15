# Shared-Link Fixtures

This directory will hold sanitized Claude shared-link fixtures once the first snapshot JSON response is captured.

Do not commit raw live responses until they have been reviewed and sanitized.

Current candidate links are tracked in [../live-links.md](../live-links.md).

## Fixtures

- `plain-text-kelp.snapshot.json`: sanitized snapshot JSON captured from the first live Claude shared link. UUIDs and creator fields are replaced with stable fixture values; public prompt/response text is preserved for parser coverage.
- `underground-city.snapshot.json`: sanitized long multi-turn snapshot JSON. UUIDs and creator fields are replaced with stable fixture values; public conversation text is preserved. Includes `text`, `tool_use`, and `tool_result` content blocks for graceful-degradation coverage.
- `wrapped-minimal.snapshot.json`: synthetic wrapper fixture proving the parser can find a snapshot under common API wrapper keys.
- `unsupported-shape.snapshot.json`: synthetic negative fixture with no `chat_messages`, used to keep unsupported shapes actionable.
- `malformed.snapshot.json`: intentionally invalid JSON used to verify malformed snapshot failures.
- `code-block.snapshot.json`: synthetic Markdown renderer fixture proving heading demotion does not alter fenced code comments.
