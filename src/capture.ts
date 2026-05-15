import os from "node:os";
import path from "node:path";
import { chromium, type Page, type Response } from "playwright";
import { findSnapshotPayload } from "./snapshot.js";
import type { ClaudeSnapshot } from "./types.js";

export interface CaptureOptions {
  url: string;
  profileDir?: string;
  timeoutMs: number;
  log?: (message: string) => void;
}

export function defaultProfileDir(): string {
  return path.join(os.homedir(), ".claude-thread-exporter", "chromium-profile");
}

export async function captureClaudeSnapshot(options: CaptureOptions): Promise<ClaudeSnapshot> {
  const profileDir = options.profileDir ?? defaultProfileDir();
  const log = options.log ?? (() => undefined);
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  let page: Page | undefined;
  let snapshotWaiter: SnapshotResponseWaiter | undefined;

  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1440, height: 1000 }
    });
    page = context.pages()[0] ?? (await context.newPage());
    snapshotWaiter = createSnapshotResponseWaiter(page, options.timeoutMs);

    log(`Opening Claude share link in Playwright Chromium.`);
    log(`Chromium profile: ${profileDir}`);
    log("If Claude asks you to sign in or complete a browser check, do it in that window. The CLI will keep waiting.");

    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    return await snapshotWaiter.promise;
  } catch (error) {
    snapshotWaiter?.cancel();
    throw new Error(await buildCaptureFailureMessage(error, page, profileDir));
  } finally {
    await context?.close();
  }
}

export async function buildCaptureFailureMessage(error: unknown, page: Page | undefined, profileDir: string): Promise<string> {
  const detail = error instanceof Error ? error.message : String(error);

  if (isMissingChromiumError(detail)) {
    return [
      "Could not start Playwright Chromium.",
      "",
      "The browser binary does not appear to be installed for this project.",
      "Run:",
      "  npx playwright install chromium",
      "",
      `Chromium profile directory: ${profileDir}`,
      `Details: ${detail}`
    ].join("\n");
  }

  const pageState = await readPageState(page);
  const authHint = classifyPageState(pageState);

  return [
    "Could not capture Claude snapshot JSON from the browser session.",
    "",
    authHint,
    "",
    "What to do:",
    "  1. Re-run the same command.",
    "  2. When the Playwright Chromium window opens, complete any Claude sign-in, auth, or browser check there.",
    "  3. If Cloudflare verification loops or never completes, this Claude link cannot be captured reliably through Playwright right now.",
    "  4. Use --snapshot-json with a previously captured snapshot JSON file, or try again later with the same profile.",
    "",
    "Safari and your normal Chrome app are separate sessions. This CLI can only reuse its Playwright Chromium profile.",
    `Chromium profile directory: ${profileDir}`,
    pageState.url ? `Last browser URL: ${pageState.url}` : "",
    pageState.title ? `Last page title: ${pageState.title}` : "",
    `Details: ${detail}`
  ]
    .filter(Boolean)
    .join("\n");
}

function isMissingChromiumError(detail: string): boolean {
  return (
    detail.includes("Executable doesn't exist") ||
    detail.includes("browserType.launchPersistentContext") && detail.includes("playwright install")
  );
}

async function readPageState(page: Page | undefined): Promise<{ url: string; title: string }> {
  if (!page) {
    return { url: "", title: "" };
  }

  const url = page.url();
  let title = "";
  try {
    title = await page.title();
  } catch {
    title = "";
  }

  return { url, title };
}

function classifyPageState(pageState: { url: string; title: string }): string {
  const combined = `${pageState.url} ${pageState.title}`.toLowerCase();

  if (
    combined.includes("login") ||
    combined.includes("auth") ||
    combined.includes("oauth") ||
    /\bsign[ -]?in\b/u.test(combined)
  ) {
    return "Claude appears to be showing an authentication page instead of the shared chat snapshot.";
  }

  if (
    combined.includes("challenge") ||
    combined.includes("cloudflare") ||
    combined.includes("verify") ||
    combined.includes("just a moment") ||
    combined.includes("checking your browser")
  ) {
    return "Claude appears to be showing a browser verification page instead of the shared chat snapshot.";
  }

  return "The Claude page loaded, but the expected /api/chat_snapshots response did not appear before the timeout.";
}

export interface SnapshotResponseWaiter {
  promise: Promise<ClaudeSnapshot>;
  cancel: () => void;
}

export function createSnapshotResponseWaiter(page: Pick<Page, "on" | "off">, timeoutMs: number): SnapshotResponseWaiter {
  let settled = false;
  let timeout: ReturnType<typeof setTimeout>;
  let onResponse: (response: Response) => void = () => undefined;

  const cleanup = (): void => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeout);
    page.off("response", onResponse);
  };

  const promise = new Promise<ClaudeSnapshot>((resolve, reject) => {
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for /api/chat_snapshots response.`));
    }, timeoutMs);

    onResponse = (response: Response): void => {
      const url = response.url();
      if (!url.includes("/api/chat_snapshots/")) {
        return;
      }

      void response
        .json()
        .then((json: unknown) => {
          const snapshot = findSnapshotPayload(json);
          if (!snapshot) {
            return;
          }
          cleanup();
          resolve(snapshot);
        })
        .catch(() => {
          // Some non-JSON challenge responses can still match the URL. Keep waiting.
        });
    };

    page.on("response", onResponse);
  });

  return { promise, cancel: cleanup };
}
