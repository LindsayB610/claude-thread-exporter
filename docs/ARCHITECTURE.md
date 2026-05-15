# Architecture Notes

This directory is for implementation notes that are more tactical than the main plan.

Expected early documents:

- extractor assumptions about Claude shared-link page structure
- fixture capture notes
- compatibility and debug artifact contracts
- artifact rendering behavior
- GitHub writer behavior notes
- release checklist notes

Build notes:

- `tsconfig.json` is for editor/typecheck coverage across `src/` and `test/`
- `tsconfig.build.json` is for production CLI output from `src/` only

Pipeline target:

- fetch Claude shared-link HTML
- extract visible shared-chat payload data
- normalize turns and artifacts into stable internal types
- render Markdown
- emit to stdout, local files, or explicit GitHub destinations
