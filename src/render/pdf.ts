import { chromium } from "playwright";
import type { RenderInput } from "../types.js";
import { renderClaudeHtml } from "./html.js";

export async function renderPdf(input: RenderInput, outPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(renderClaudeHtml(input), { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: outPath,
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(),
      margin: {
        top: "14mm",
        right: "10mm",
        bottom: "18mm",
        left: "10mm"
      }
    });
    await page.close();
  } finally {
    await browser.close();
  }
}

function footerTemplate(): string {
  return `
    <div style="width:100%; padding:0 10mm; font-family:Arial, sans-serif; font-size:9px; color:#8a8580; text-align:center;">
      <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>
  `.trim();
}
