import "server-only";
import type { Browser, Page } from "puppeteer-core";
import { BROWSER_HEADERS } from "@/lib/show-finder-run";

// Opens a web page in a real (headless) Chrome, so lists that a page builds
// with JavaScript after it loads are there to read, as many exhibitor
// directories do. On Vercel the Chrome comes from @sparticuz/chromium; on a
// developer's machine set CHROMIUM_PATH to a local Chrome or Chromium.

const NAVIGATION_TIMEOUT_MS = 30_000;
/** At most this long in total per page, so a slow site can't use up the request. */
const TOTAL_BUDGET_MS = 60_000;
/** How often "Load more" buttons are pressed and the page scrolled down. */
const MAX_ROUNDS = 25;
/** Data the page loads (JSON) larger than this is left out. */
const MAX_JSON_CHARS = 2_000_000;

export type RenderedPage = {
  /** The page's HTML after its scripts have run. */
  html: string;
  /** JSON the page loaded in the background, which often holds the whole list. */
  data: string[];
};

async function launch(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const local = process.env.CHROMIUM_PATH;
  if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true, args: chromium.args });
}

const LOAD_MORE = /^(load|show|view|see)\s+(more|all)|more (results|exhibitors|companies)|vis flere|mehr (laden|anzeigen)|weitere/i;

/** Presses a visible "Load more" style button, if the page has one. Returns whether it did. */
async function pressLoadMore(page: Page): Promise<boolean> {
  return page.evaluate((pattern: string) => {
    const re = new RegExp(pattern, "i");
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("button, a[role=button], [class*=load], [class*=more]"));
    for (const el of candidates) {
      const text = (el.innerText || "").trim();
      if (!text || text.length > 40 || !re.test(text)) continue;
      if (el instanceof HTMLAnchorElement && el.href && !el.href.includes("#") && !el.getAttribute("role")) continue; // a real link to another page
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || (el as HTMLButtonElement).disabled) continue;
      el.click();
      return true;
    }
    return false;
  }, LOAD_MORE.source);
}

/**
 * Opens the page, waits for its scripts to fill it in, scrolls down and
 * presses "Load more" until nothing more appears, and returns the result.
 */
export async function renderPage(url: string): Promise<RenderedPage> {
  const started = Date.now();
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_HEADERS["User-Agent"]);
    await page.setExtraHTTPHeaders({ "Accept-Language": BROWSER_HEADERS["Accept-Language"] });
    await page.setViewport({ width: 1366, height: 900 });

    // Keep the JSON the page fetches; skip pictures, fonts and video to save time.
    const data: string[] = [];
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "media", "font"].includes(req.resourceType())) void req.abort();
      else void req.continue();
    });
    page.on("response", async (res) => {
      const type = res.request().resourceType();
      if (type !== "xhr" && type !== "fetch") return;
      if (!(res.headers()["content-type"] ?? "").includes("json")) return;
      try {
        const body = await res.text();
        if (body.length > 200 && body.length <= MAX_JSON_CHARS) data.push(body);
      } catch {
        // The body is gone, e.g. after a redirect; nothing to keep.
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: NAVIGATION_TIMEOUT_MS });

    let lastHeight = 0;
    let lastLength = 0;
    for (let round = 0; round < MAX_ROUNDS && Date.now() - started < TOTAL_BUDGET_MS; round++) {
      const pressed = await pressLoadMore(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForNetworkIdle({ idleTime: 700, timeout: 8_000 }).catch(() => {});
      const [height, length] = await page.evaluate(() => [document.body.scrollHeight, document.body.innerText.length]);
      if (!pressed && height === lastHeight && length === lastLength) break;
      lastHeight = height;
      lastLength = length;
    }
    return { html: await page.content(), data };
  } finally {
    await browser.close().catch(() => {});
  }
}
