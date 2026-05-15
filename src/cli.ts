#!/usr/bin/env node
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  HelpRequested,
  captureClaudeSnapshot,
  helpText,
  parseArgs,
  readSnapshotFile,
  renderClaudeHtml,
  renderMarkdown,
  renderPdf,
  resolveDefaultOutPath,
  writeGitHubFile
} from "./index.js";
import { snapshotTitle } from "./render/shared.js";
import type { ClaudeSnapshot, CliOptions, RenderInput } from "./types.js";

async function main(argv: string[]): Promise<void> {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      process.stdout.write(`${helpText}\n`);
      return;
    }
    throw error;
  }

  const snapshot = options.snapshotPath
    ? await readSnapshotFile(options.snapshotPath)
    : await captureClaudeSnapshot({
        url: options.url!,
        profileDir: options.profileDir,
        timeoutMs: options.timeoutMs,
        log: createUrlCaptureLogger()
      });

  if (options.saveSnapshotPath) {
    await writeJson(options.saveSnapshotPath, snapshot, options.force);
    process.stderr.write(`Saved snapshot JSON to ${options.saveSnapshotPath}\n`);
  }

  const input: RenderInput = {
    snapshot,
    sourceUrl: options.sourceUrl ?? options.url
  };

  if (options.stdout) {
    process.stdout.write(renderStdout(input, options.format));
    return;
  }

  if (options.out || !options.repo) {
    const outPath = options.out ?? (await resolveDefaultOutPath(snapshotTitle(snapshot), options.format));
    await writeLocalExport(input, outPath, options);
    process.stderr.write(`Saved ${options.format.toUpperCase()} export to ${outPath}\n`);
  }

  if (options.repo && options.repoPath) {
    const content = await renderGitHubContent(input, options);
    await writeGitHubFile({
      repo: options.repo,
      repoPath: options.repoPath,
      branch: options.branch,
      content,
      force: options.force
    });
    process.stderr.write(`Saved ${options.format.toUpperCase()} export to GitHub: ${options.repo}/${options.repoPath}\n`);
  }
}

function createUrlCaptureLogger(): (message: string) => void {
  let warned = false;

  return (message) => {
    if (!warned) {
      process.stderr.write(
        [
          "Warning: Claude live URL capture is experimental.",
          "Claude/Cloudflare may block or loop browser verification in Playwright Chromium.",
          "If that happens, try again later or export from a saved snapshot JSON with --snapshot-json.",
          ""
        ].join("\n")
      );
      warned = true;
    }

    process.stderr.write(`${message}\n`);
  };
}

function renderStdout(input: RenderInput, format: "md" | "html" | "pdf"): string {
  if (format === "md") {
    return renderMarkdown(input);
  }

  if (format === "html") {
    return renderClaudeHtml(input);
  }

  throw new Error("PDF output cannot be written to stdout. Use --out or omit --stdout.");
}

async function writeLocalExport(input: RenderInput, outPath: string, options: CliOptions): Promise<void> {
  await mkdir(path.dirname(outPath), { recursive: true });

  if (options.format === "pdf") {
    await assertWritable(outPath, options.force);
    await renderPdf(input, outPath);
    return;
  }

  await writeTextFile(outPath, renderStdout(input, options.format), options.force);
}

async function renderGitHubContent(input: RenderInput, options: CliOptions): Promise<string | Uint8Array> {
  if (options.format !== "pdf") {
    return renderStdout(input, options.format);
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "claude-exporter-github-"));
  const tmpPath = path.join(tmpDir, "export.pdf");

  try {
    await renderPdf(input, tmpPath);
    return await readFile(tmpPath);
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
}

async function writeJson(pathname: string, snapshot: ClaudeSnapshot, force: boolean): Promise<void> {
  await mkdir(path.dirname(pathname), { recursive: true });
  await writeTextFile(pathname, `${JSON.stringify(snapshot, null, 2)}\n`, force);
}

async function writeTextFile(pathname: string, contents: string, force: boolean): Promise<void> {
  await assertWritable(pathname, force);
  await writeFile(pathname, contents, "utf8");
}

async function assertWritable(pathname: string, force: boolean): Promise<void> {
  if (force) {
    return;
  }

  try {
    await access(pathname);
  } catch {
    return;
  }

  throw new Error(`Refusing to overwrite existing file: ${pathname}\nRe-run with --force to overwrite it.`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
