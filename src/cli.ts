const HELP_TEXT = `claude-thread-exporter

Usage:
  claude-thread-exporter --url "https://claude.ai/share/..."

Status:
  The repository scaffold and implementation plan are in place.
  The exporter implementation is intentionally pending fixture capture.
`;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(`${HELP_TEXT}\n`);
} else {
  process.stderr.write(
    "claude-thread-exporter is not implemented yet. See CLAUDE_EXPORT_PLAN.md for the current plan.\n"
  );
  process.exitCode = 1;
}
