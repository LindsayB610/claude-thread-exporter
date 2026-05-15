import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  buildCaptureFailureMessage,
  createSnapshotResponseWaiter,
  packageName,
  parseArgs,
  parseSnapshotJson,
  readSnapshotFile,
  resolveDefaultOutPath,
  renderClaudeHtml,
  renderMarkdown
} from "../src/index.js";

const execFileAsync = promisify(execFile);

describe("package scaffold", () => {
  it("exports the package name", () => {
    expect(packageName).toBe("claude-thread-exporter");
  });
});

describe("CLI args", () => {
  it("parses a URL export using the Chromium capture path", () => {
    expect(parseArgs(["--url", "https://claude.ai/share/example", "--format", "pdf"])).toMatchObject({
      url: "https://claude.ai/share/example",
      format: "pdf",
      timeoutMs: 120_000,
      force: false
    });
  });

  it("parses the full V1 option set", () => {
    expect(
      parseArgs([
        "--snapshot",
        "fixtures/thread.snapshot.json",
        "--source",
        "https://claude.ai/share/example",
        "--format",
        "html",
        "--out",
        "exports/thread.html",
        "--profile-dir",
        ".profiles/claude",
        "--timeout",
        "180000",
        "--save-snapshot",
        "fixtures/captured.snapshot.json",
        "--force"
      ])
    ).toMatchObject({
      snapshotPath: "fixtures/thread.snapshot.json",
      sourceUrl: "https://claude.ai/share/example",
      format: "html",
      out: "exports/thread.html",
      profileDir: ".profiles/claude",
      timeoutMs: 180_000,
      saveSnapshotPath: "fixtures/captured.snapshot.json",
      force: true
    });
  });

  it("rejects non-Claude share URLs", () => {
    expect(() => parseArgs(["--url", "https://example.com/share/example"])).toThrow(
      "Expected a Claude share URL"
    );
  });

  it("does not allow PDF stdout", () => {
    expect(() =>
      parseArgs(["--snapshot", "fixtures/shared-links/plain-text-kelp.snapshot.json", "--format", "pdf", "--stdout"])
    ).toThrow("--stdout is only supported");
  });

  it("requires exactly one input source", () => {
    expect(() => parseArgs([])).toThrow("Missing input");
    expect(() =>
      parseArgs(["--url", "https://claude.ai/share/example", "--snapshot", "fixtures/thread.snapshot.json"])
    ).toThrow("Use either --url or --snapshot");
  });

  it("rejects conflicting destinations", () => {
    expect(() =>
      parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--out", "exports/thread.md", "--stdout"])
    ).toThrow("Use either --stdout or --out");
  });

  it("rejects invalid option values", () => {
    expect(() => parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--format", "docx"])).toThrow(
      "Unsupported format"
    );
    expect(() => parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--timeout", "0"])).toThrow(
      "Invalid timeout"
    );
    expect(() => parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--out"])).toThrow(
      "Missing value for --out"
    );
    expect(() => parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--wat"])).toThrow("Unknown option");
  });

  it("validates explicit output paths before capture", () => {
    expect(() => parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--out", "exports/"])).toThrow(
      "--out must be a file path"
    );
    expect(() => parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--out", "../thread.md"])).toThrow(
      "--out must not contain parent-directory traversal"
    );
    expect(() =>
      parseArgs(["--snapshot", "fixtures/thread.snapshot.json", "--save-snapshot", "../thread.snapshot.json"])
    ).toThrow("--save-snapshot must not contain parent-directory traversal");
  });
});

describe("snapshot parsing", () => {
  it("finds direct Claude snapshot payloads", () => {
    const snapshot = parseSnapshotJson(
      JSON.stringify({
        snapshot_name: "Example",
        chat_messages: []
      })
    );

    expect(snapshot.snapshot_name).toBe("Example");
  });

  it("finds wrapped Claude snapshot payloads from fixture files", async () => {
    const snapshot = await readSnapshotFile("fixtures/shared-links/wrapped-minimal.snapshot.json");

    expect(snapshot).toMatchObject({
      uuid: "snapshot-wrapped-minimal",
      snapshot_name: "Wrapped Minimal Snapshot"
    });
    expect(snapshot.chat_messages).toHaveLength(1);
  });

  it("parses the committed public-safe Claude fixtures", async () => {
    const kelp = await readSnapshotFile("fixtures/shared-links/plain-text-kelp.snapshot.json");
    const underground = await readSnapshotFile("fixtures/shared-links/underground-city.snapshot.json");
    const codeBlock = await readSnapshotFile("fixtures/shared-links/code-block.snapshot.json");

    expect(kelp.snapshot_name).toBe("Kelp forests and coastal ecosystem importance");
    expect(kelp.chat_messages).toHaveLength(2);
    expect(underground.snapshot_name).toBe("Designing a fictional underground city");
    expect(underground.chat_messages).toHaveLength(24);
    expect(codeBlock.snapshot_name).toBe("Code Block Rendering");
    expect(codeBlock.chat_messages).toHaveLength(2);
    expect(
      underground.chat_messages?.flatMap((message) => message.content ?? []).map((block) => block.type)
    ).toEqual(expect.arrayContaining(["text", "tool_use", "tool_result"]));
  });

  it("rejects unsupported snapshot-shaped JSON with an actionable message", async () => {
    await expect(readSnapshotFile("fixtures/shared-links/unsupported-shape.snapshot.json")).rejects.toThrow(
      "Snapshot JSON did not contain a Claude chat snapshot payload."
    );
  });

  it("rejects malformed snapshot JSON", async () => {
    await expect(readSnapshotFile("fixtures/shared-links/malformed.snapshot.json")).rejects.toThrow();
  });
});

describe("capture errors", () => {
  it("resolves captured Claude snapshot responses and unregisters the listener", async () => {
    const page = new FakePage();
    const waiter = createSnapshotResponseWaiter(page as never, 1000);

    page.emit("response", new FakeResponse("https://claude.ai/api/chat_snapshots/example", {
      snapshot_name: "Captured",
      chat_messages: []
    }));

    await expect(waiter.promise).resolves.toMatchObject({ snapshot_name: "Captured" });
    expect(page.listenerCount("response")).toBe(0);
  });

  it("can cancel a pending snapshot response wait without leaving a listener behind", () => {
    const page = new FakePage();
    const waiter = createSnapshotResponseWaiter(page as never, 1000);

    expect(page.listenerCount("response")).toBe(1);
    waiter.cancel();
    expect(page.listenerCount("response")).toBe(0);
  });

  it("explains how to install Playwright Chromium when the browser is missing", async () => {
    const message = await buildCaptureFailureMessage(
      new Error("Executable doesn't exist at /example/chromium\nPlease run: npx playwright install"),
      undefined,
      "/tmp/profile"
    );

    expect(message).toContain("Could not start Playwright Chromium.");
    expect(message).toContain("npx playwright install chromium");
    expect(message).toContain("Chromium profile directory: /tmp/profile");
  });

  it("explains that the user may need to sign into Claude in Playwright Chromium", async () => {
    const page = {
      url: () => "https://claude.ai/login",
      title: () => Promise.resolve("Sign in to Claude"),
      off: () => undefined
    };
    const message = await buildCaptureFailureMessage(
      new Error("Timed out after 120000ms waiting for /api/chat_snapshots response."),
      page as never,
      "/tmp/profile"
    );

    expect(message).toContain("authentication page");
    expect(message).toContain("complete any Claude sign-in");
    expect(message).toContain("Cloudflare verification loops");
    expect(message).toContain("Safari and your normal Chrome app are separate sessions");
    expect(message).toContain("Last browser URL: https://claude.ai/login");
  });

  it("recognizes common browser verification pages", async () => {
    const page = {
      url: () => "https://claude.ai/share/example",
      title: () => Promise.resolve("Just a moment..."),
      off: () => undefined
    };
    const message = await buildCaptureFailureMessage(
      new Error("Timed out after 120000ms waiting for /api/chat_snapshots response."),
      page as never,
      "/tmp/profile"
    );

    expect(message).toContain("browser verification page");
    expect(message).toContain("If Cloudflare verification loops or never completes");
    expect(message).toContain("Use --snapshot with a previously captured snapshot JSON file");
    expect(message).toContain("Last page title: Just a moment...");
  });

  it("gives generic timeout guidance when no auth or browser-check page is visible", async () => {
    const page = {
      url: () => "https://claude.ai/share/example",
      title: () => Promise.resolve("Designing a fictional underground city"),
      off: () => undefined
    };
    const message = await buildCaptureFailureMessage(
      new Error("Timed out after 5000ms waiting for /api/chat_snapshots response."),
      page as never,
      "/tmp/profile"
    );

    expect(message).toContain("expected /api/chat_snapshots response did not appear before the timeout");
    expect(message).toContain("Re-run the same command");
    expect(message).toContain("Chromium profile directory: /tmp/profile");
    expect(message).toContain("Details: Timed out after 5000ms");
  });
});

class FakePage extends EventEmitter {
  on(eventName: "response", listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  off(eventName: "response", listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }
}

class FakeResponse {
  constructor(
    private readonly responseUrl: string,
    private readonly payload: unknown
  ) {}

  url(): string {
    return this.responseUrl;
  }

  async json(): Promise<unknown> {
    return this.payload;
  }
}

describe("renderers", () => {
  const input = {
    sourceUrl: "https://claude.ai/share/example",
    snapshot: {
      snapshot_name: "Tiny Thread",
      chat_messages: [
        {
          sender: "human",
          created_at: "2026-05-15T17:01:00.000Z",
          content: [{ type: "text", text: "Hello Claude\n\nSee https://example.com/reference." }]
        },
        {
          sender: "assistant",
          created_at: "2026-05-15T17:05:00.000Z",
          content: [{ type: "text", text: "# Reply\n\nHello human" }]
        }
      ]
    }
  };

  it("renders Markdown with title and conversation metadata", () => {
    const markdown = renderMarkdown(input);

    expect(markdown).toContain("# Tiny Thread");
    expect(markdown).toContain("Source: https://claude.ai/share/example");
    expect(markdown).toContain("Conversation: May 15, 2026, 10:01 AM to 10:05 AM PDT");
    expect(markdown).toContain("## You");
    expect(markdown).toContain("## Claude");
  });

  it("renders real fixture Markdown without leaking raw tool blocks", async () => {
    const underground = await readSnapshotFile("fixtures/shared-links/underground-city.snapshot.json");
    const markdown = renderMarkdown({
      snapshot: underground,
      sourceUrl: "https://claude.ai/share/f750dcac-e458-4228-9b5c-45e3b495aab4"
    });

    expect(markdown).toContain("# Designing a fictional underground city");
    expect(markdown).toContain("Source: https://claude.ai/share/f750dcac-e458-4228-9b5c-45e3b495aab4");
    expect(markdown).toContain("[Visual artifact: tunnel mouse specimen]");
    expect(markdown).toContain("[Visual artifact: bloom specimen]");
    expect(markdown).not.toContain("tool_use");
    expect(markdown).not.toContain("tool_result");
  });

  it("demotes assistant headings without changing fenced code content", async () => {
    const snapshot = await readSnapshotFile("fixtures/shared-links/code-block.snapshot.json");
    const markdown = renderMarkdown({ snapshot });

    expect(markdown).toMatchInlineSnapshot(`
      "# Code Block Rendering

      Source: snapshot-code-block
      Conversation: May 15, 2026, 10:10 AM to 10:11 AM PDT
      Messages: 2

      ## You

      Show me a shell script with comments.

      ## Claude

      ### Script Example

      \`\`\`bash
      # This comment must stay inside the code fence.
      printf '%s\\n' "hello"
      \`\`\`

      ### Notes

      The heading outside the fence should be demoted.
      "
    `);
    expect(markdown).toContain("### Script Example");
    expect(markdown).toContain("### Notes");
    expect(markdown).toContain("```bash\n# This comment must stay inside the code fence.\nprintf");
    expect(markdown).not.toContain("\n# Script Example");
  });

  it("renders HTML with a first-page export header", () => {
    const html = renderClaudeHtml(input);

    expect(html).toContain('<p class="export-brand">Claude Export</p>');
    expect(html).toContain('<h1 class="export-title">Tiny Thread</h1>');
    expect(html).toContain(
      '<a href="https://claude.ai/share/example">https://claude.ai/share/example</a>'
    );
    expect(html).toContain('<a href="https://example.com/reference">https://example.com/reference</a>.');
    expect(html).not.toContain("topbar");
  });

  it("renders assistant Markdown links in HTML/PDF output", () => {
    const html = renderClaudeHtml({
      snapshot: {
        snapshot_name: "Assistant Link",
        chat_messages: [
          {
            sender: "assistant",
            created_at: "2026-05-15T17:05:00.000Z",
            content: [{ type: "text", text: "Read [the reference](https://example.com/reference)." }]
          }
        ]
      }
    });

    expect(html).toContain('<a href="https://example.com/reference">the reference</a>');
  });

  it("renders real fixture SVG visuals in HTML without leaking internal tool blocks", async () => {
    const underground = await readSnapshotFile("fixtures/shared-links/underground-city.snapshot.json");
    const html = renderClaudeHtml({
      snapshot: underground,
      sourceUrl: "https://claude.ai/share/f750dcac-e458-4228-9b5c-45e3b495aab4"
    });

    expect(html).toContain("<title>Tunnel mouse specimen plate</title>");
    expect(html).toContain("<title>The Bloom specimen plate</title>");
    expect(html).toContain("<figcaption>tunnel mouse specimen</figcaption>");
    expect(html).toContain("<figcaption>bloom specimen</figcaption>");
    expect(html).not.toContain("tool_use");
    expect(html).not.toContain("tool_result");
    expect(html).not.toContain("omitted");
  });

  it("renders assistant raw HTML as text in HTML/PDF output", () => {
    const html = renderClaudeHtml({
      snapshot: {
        snapshot_name: "Raw HTML Safety",
        chat_messages: [
          {
            sender: "assistant",
            created_at: "2026-05-15T17:05:00.000Z",
            content: [{ type: "text", text: "Here is raw markup:\n\n<script>alert('nope')</script>" }]
          }
        ]
      }
    });

    expect(html).toContain("&lt;script&gt;alert(&#39;nope&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("sanitizes SVG visual artifacts before HTML/PDF rendering", () => {
    const html = renderClaudeHtml({
      snapshot: {
        snapshot_name: "Visual Safety",
        chat_messages: [
          {
            sender: "assistant",
            created_at: "2026-05-15T17:05:00.000Z",
            content: [
              {
                type: "tool_use",
                name: "visualize:show_widget",
                input: {
                  title: "unsafe_widget",
                  widget_code:
                    '<svg width="100%" viewBox="0 0 100 100" role="img" onload="alert(1)"><title>Safe</title><script>alert(1)</script><a href="javascript:alert(1)"><rect width="100" height="100"/></a></svg>'
                }
              }
            ]
          }
        ]
      }
    });

    expect(html).toContain("<svg");
    expect(html).toContain("<title>Safe</title>");
    expect(html).toContain("<rect");
    expect(html).toContain("<figcaption>unsafe widget</figcaption>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onload=");
    expect(html).not.toContain("javascript:");
  });
});

describe("local output", () => {
  it("resolves unique default Downloads-style paths", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "claude-exporter-output-"));
    await writeFile(path.join(tmpDir, "tiny-thread-claude-export.md"), "first");
    await writeFile(path.join(tmpDir, "tiny-thread-claude-export-2.md"), "second");

    await expect(resolveDefaultOutPath("Tiny Thread", "md", tmpDir)).resolves.toBe(
      path.join(tmpDir, "tiny-thread-claude-export-3.md")
    );
  });

  it("writes explicit CLI output, creates parent directories, and protects overwrites", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "claude-exporter-cli-"));
    const outPath = path.join(tmpDir, "nested", "kelp.md");
    const args = [
      "src/cli.ts",
      "--snapshot",
      "fixtures/shared-links/plain-text-kelp.snapshot.json",
      "--source",
      "https://claude.ai/share/7b2442ee-2ffb-4f82-8852-291840cf5ca0",
      "--out",
      outPath
    ];

    const firstRun = await execFileAsync("npx", ["tsx", ...args], { cwd: process.cwd() });
    await expect(readFile(outPath, "utf8")).resolves.toContain("# Kelp forests and coastal ecosystem importance");
    expect(firstRun.stderr).toContain(`Saved MD export to ${outPath}`);

    await expect(execFileAsync("npx", ["tsx", ...args], { cwd: process.cwd() })).rejects.toMatchObject({
      stderr: expect.stringContaining("Refusing to overwrite existing file")
    });

    await execFileAsync("npx", ["tsx", ...args, "--force"], { cwd: process.cwd() });
    await expect(readFile(outPath, "utf8")).resolves.toContain(
      "Source: https://claude.ai/share/7b2442ee-2ffb-4f82-8852-291840cf5ca0"
    );
  });

  it("prints HTML to stdout through the CLI", async () => {
    const { stdout, stderr } = await execFileAsync(
      "npx",
      [
        "tsx",
        "src/cli.ts",
        "--snapshot",
        "fixtures/shared-links/plain-text-kelp.snapshot.json",
        "--format",
        "html",
        "--stdout"
      ],
      { cwd: process.cwd() }
    );

    expect(stdout).toContain("<!doctype html>");
    expect(stdout).toContain('<p class="export-brand">Claude Export</p>');
    expect(stderr).toBe("");
  });
});
