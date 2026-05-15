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
  --profile-dir <path>    Chromium profile directory. Defaults to ~/.claude-thread-exporter/chromium-profile.
  --timeout <ms>          Capture timeout. Defaults to 120000.
  --save-snapshot <path>  Save the captured snapshot JSON for debugging or repeat exports.
  --force                 Overwrite an explicit --out or --save-snapshot file if it exists.
  -h, --help              Show help.

Browser note:
  Live URL export is experimental because Claude/Cloudflare can loop browser verification
  in Playwright Chromium. Snapshot JSON export is the reliable local path.
  Safari sessions cannot be reused by Playwright.
  If Chromium is missing, run: npx playwright install chromium
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

  if (options.stdout && options.format === "pdf") {
    throw new Error("--stdout is only supported for md and html exports.");
  }

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
