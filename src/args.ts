import type { CliOptions, ExportFormat } from "./types.js";

export const helpText = `claude-thread-exporter

Usage:
  claude-thread-exporter --url "https://claude.ai/share/..." [--format md|html|pdf]
  claude-thread-exporter --snapshot ./snapshot.json [--format md|html|pdf]

Options:
  --url <url>             Experimental: capture a Claude share URL with headed Playwright Chromium.
  --snapshot <path>       Export from an already captured Claude snapshot JSON file.
  --source <url>          Source URL to show in exports when using --snapshot.
  --format <format>       md, html, or pdf. Defaults to md.
  --out <path>            Output path. Defaults to Downloads with a title-based filename.
  --stdout                Print md/html to stdout instead of writing a file.
  --repo <owner/name>     Also write the export to a GitHub repository.
  --repo-path <path>      Repository-relative destination path for --repo.
  --branch <branch>       GitHub branch to write to. Defaults to the repo default branch.
  --profile-dir <path>    Chromium profile directory. Defaults to ~/.claude-thread-exporter/chromium-profile.
  --timeout <ms>          Capture timeout. Defaults to 120000.
  --save-snapshot <path>  Save the captured snapshot JSON for debugging or repeat exports.
  --force                 Overwrite an explicit --out, --save-snapshot, or GitHub file if it exists.
  -h, --help              Show help.

Browser note:
  Live URL export is experimental because Claude/Cloudflare can loop browser verification
  in Playwright Chromium. Snapshot JSON export is the reliable local path.
  Safari sessions cannot be reused by Playwright.
  If Chromium is missing, run: npx playwright install chromium

GitHub note:
  GitHub export uses GITHUB_TOKEN and writes exactly to --repo-path.
  The branch must already exist; this CLI does not create branches.
`;

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    stdout: false,
    format: "md",
    timeoutMs: 120_000,
    force: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    switch (arg) {
      case "--url":
        options.url = readValue(argv, ++index, arg);
        break;
      case "--snapshot":
        options.snapshotPath = readValue(argv, ++index, arg);
        break;
      case "--source":
        options.sourceUrl = readValue(argv, ++index, arg);
        break;
      case "--format":
        options.format = parseFormat(readValue(argv, ++index, arg));
        break;
      case "--out":
        options.out = readValue(argv, ++index, arg);
        break;
      case "--stdout":
        options.stdout = true;
        break;
      case "--repo":
        options.repo = readValue(argv, ++index, arg);
        break;
      case "--repo-path":
        options.repoPath = readValue(argv, ++index, arg);
        break;
      case "--branch":
        options.branch = readValue(argv, ++index, arg);
        break;
      case "--profile-dir":
        options.profileDir = readValue(argv, ++index, arg);
        break;
      case "--timeout":
        options.timeoutMs = parseTimeout(readValue(argv, ++index, arg));
        break;
      case "--save-snapshot":
        options.saveSnapshotPath = readValue(argv, ++index, arg);
        break;
      case "--force":
        options.force = true;
        break;
      case "-h":
      case "--help":
        throw new HelpRequested();
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.url && !options.snapshotPath) {
    throw new Error("Missing input. Provide --url or --snapshot.");
  }

  if (options.url && options.snapshotPath) {
    throw new Error("Use either --url or --snapshot, not both.");
  }

  if (options.stdout && options.out) {
    throw new Error("Use either --stdout or --out, not both.");
  }

  if (options.stdout && options.repo) {
    throw new Error("Use either --stdout or --repo, not both.");
  }

  if (options.stdout && options.format === "pdf") {
    throw new Error("--stdout is only supported for md and html exports.");
  }

  validateGitHubOptions(options);

  if (options.url) {
    validateClaudeShareUrl(options.url);
  }

  if (options.out) {
    validateOutputPath(options.out, "--out");
  }

  if (options.saveSnapshotPath) {
    validateOutputPath(options.saveSnapshotPath, "--save-snapshot");
  }

  return options;
}

export class HelpRequested extends Error {
  constructor() {
    super("Help requested");
  }
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseFormat(value: string): ExportFormat {
  if (value === "md" || value === "html" || value === "pdf") {
    return value;
  }
  throw new Error(`Unsupported format: ${value}. Expected md, html, or pdf.`);
}

function parseTimeout(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid timeout: ${value}. Expected a positive number of milliseconds.`);
  }
  return parsed;
}

function validateClaudeShareUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Claude share URL: ${value}`);
  }

  if (url.hostname !== "claude.ai" || !url.pathname.startsWith("/share/")) {
    throw new Error("Expected a Claude share URL like https://claude.ai/share/...");
  }
}

function validateOutputPath(value: string, flag: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${flag} must not be empty.`);
  }

  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.includes("..")) {
    throw new Error(`${flag} must not contain parent-directory traversal.`);
  }

  if (normalized.endsWith("/")) {
    throw new Error(`${flag} must be a file path, not a directory.`);
  }
}

function validateGitHubOptions(options: CliOptions): void {
  if (options.repo && !options.repoPath) {
    throw new Error("--repo requires --repo-path.");
  }

  if (options.repoPath && !options.repo) {
    throw new Error("--repo-path requires --repo.");
  }

  if (options.branch && !options.repo) {
    throw new Error("--branch requires --repo.");
  }

  if (options.repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(options.repo)) {
    throw new Error("--repo must use owner/name form.");
  }

  if (options.repoPath) {
    validateRepoPath(options.repoPath);
  }
}

function validateRepoPath(value: string): void {
  if (value.trim().length === 0) {
    throw new Error("--repo-path must not be empty.");
  }

  if (value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error("--repo-path must be a repository-relative file path.");
  }

  if (value.includes("\\")) {
    throw new Error("--repo-path must use forward slashes.");
  }

  if (value.includes("//")) {
    throw new Error("--repo-path must not contain repeated slashes.");
  }

  if (value.endsWith("/")) {
    throw new Error("--repo-path must be a file path, not a directory.");
  }

  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "..")) {
    throw new Error("--repo-path must not contain parent-directory traversal.");
  }
}
