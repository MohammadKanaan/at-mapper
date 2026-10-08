/**
 * Capture the Chrome Web Store marketing assets from a live Chromium session
 * with the unpacked extension in dist/ loaded.
 *
 *   bun run build
 *   node scripts/capture-store-assets.mjs
 *
 * Writes:
 *   store/screenshots/01-autocomplete.png  (1280×800)
 *   store/screenshots/02-inline-add.png    (1280×800)
 *   store/screenshots/03-popup.png         (1280×800)
 *   store/screenshots/04-mappings.png      (1280×800)
 *   store/screenshots/05-sites.png         (1280×800)
 *   store/promo/small-tile-440x280.png     (440×280)
 *   store/promo/marquee-1400x560.png       (1400×560)
 *
 * The session is headed on purpose. Chromium ignores unpacked extensions in
 * headless mode, and Google Chrome no longer accepts `--load-extension`, so
 * the script drives Playwright's bundled Chromium.
 *
 * The script finds Playwright in the project, in global npm, in bun, or in an
 * npx install, and picks the copy whose Chromium build is present. If none
 * works, run `npx playwright install chromium` with a matching Playwright
 * version, or set PLAYWRIGHT_PACKAGE to a playwright entry point.
 */
/* global document, chrome */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const DIST = resolve(ROOT, "dist");
const CAPTURE_DIR = resolve(ROOT, "scripts", "capture");
const SHOTS_DIR = resolve(ROOT, "store", "screenshots");
const PROMO_DIR = resolve(ROOT, "store", "promo");

/** Seeded so every screenshot shows a believable, populated account. */
const MAPPINGS = {
  sig: "Best regards,\nAlex",
  signature: "Alex Rivera, Product Engineer",
  email: "alex@example.com",
  meeting: "Are you free tomorrow at 10:00?",
  thanks: "Thanks so much, I really appreciate it!",
};
const SETTINGS = {
  trigger: "@",
  caseSensitive: false,
  globalEnabledByDefault: true,
  theme: "light",
};
const SITE_OVERRIDES = {
  "mail.google.com": true,
  "twitter.com": false,
  "news.ycombinator.com": false,
};

function listDirs(dir) {
  try {
    return readdirSync(dir).map((name) => join(dir, name));
  } catch {
    return [];
  }
}

/**
 * Return a Playwright module whose Chromium binary is actually installed.
 * Several Playwright versions coexist on a dev machine; only the one matching
 * the cached browser revision can launch.
 */
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [];
  const add = (candidate) => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  };

  add(process.env.PLAYWRIGHT_PACKAGE);
  add("playwright-core");
  add("playwright");
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    add(join(globalRoot, "playwright"));
    add(join(globalRoot, "playwright", "node_modules", "playwright-core"));
  } catch {
    /* npm is optional */
  }
  add(join(homedir(), ".bun", "install", "global", "node_modules", "playwright-core"));
  for (const dir of listDirs(join(homedir(), ".npm", "_npx"))) {
    add(join(dir, "node_modules", "playwright"));
    add(join(dir, "node_modules", "playwright-core"));
  }
  for (const dir of listDirs(join(homedir(), ".bun", "install", "cache"))) {
    if (dir.includes("playwright-core")) add(dir);
  }

  let firstLoaded = null;
  for (const candidate of candidates) {
    try {
      const pw = require(candidate);
      firstLoaded ??= pw;
      const executable = pw.chromium?.executablePath?.();
      if (executable && existsSync(executable)) return pw;
    } catch {
      /* not a usable install */
    }
  }
  if (firstLoaded) return firstLoaded;
  throw new Error(
    "Playwright not found. Install it (e.g. `npx playwright install chromium`) " +
      "or set PLAYWRIGHT_PACKAGE to a playwright/playwright-core entry point.",
  );
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function sendFile(res, file) {
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}

/** Serves the capture fixtures plus the live popup capture and extension icon. */
function startServer() {
  const state = { popupPng: null };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (pathname === "/icon.png") {
      void sendFile(res, resolve(ROOT, "icons", "icon-128.png"));
      return;
    }
    if (pathname === "/popup.png") {
      if (!state.popupPng) {
        res.writeHead(404);
        res.end("popup not captured yet");
        return;
      }
      res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
      res.end(state.popupPng);
      return;
    }
    const name = pathname === "/" ? "editor-fixture.html" : pathname.replace(/^\//, "");
    const file = resolve(CAPTURE_DIR, name);
    if (!file.startsWith(CAPTURE_DIR)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    void sendFile(res, file);
  });
  return { server, state };
}

async function getServiceWorker(context) {
  const [existing] = context.serviceWorkers();
  if (existing) return existing;
  return context.waitForEvent("serviceworker", { timeout: 15000 });
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(150);
}

async function shot(page, file) {
  console.log(`  capturing ${file.slice(ROOT.length + 1)}`);
  await settle(page);
  for (let attempt = 1; ; attempt++) {
    try {
      await page.screenshot({ path: file, scale: "css", animations: "disabled", timeout: 20000 });
      return;
    } catch (error) {
      if (attempt >= 2) throw error;
      console.log("    capture timed out, retrying once");
    }
  }
}

/** Read width, height, and whether a PNG has an alpha channel. */
function pngInfo(file) {
  const buf = readFileSync(file);
  const signature = buf.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${file} is not a PNG`);
  const colorType = buf[25];
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    // PNG colour types 4 (grey+alpha) and 6 (RGBA) carry transparency.
    hasAlpha: colorType === 4 || colorType === 6,
  };
}

const EXPECTED = [
  [join(SHOTS_DIR, "01-autocomplete.png"), 1280, 800],
  [join(SHOTS_DIR, "02-inline-add.png"), 1280, 800],
  [join(SHOTS_DIR, "03-popup.png"), 1280, 800],
  [join(SHOTS_DIR, "04-mappings.png"), 1280, 800],
  [join(SHOTS_DIR, "05-sites.png"), 1280, 800],
  [join(PROMO_DIR, "small-tile-440x280.png"), 440, 280],
  [join(PROMO_DIR, "marquee-1400x560.png"), 1400, 560],
];

function verify() {
  const problems = [];
  for (const [file, width, height] of EXPECTED) {
    if (!existsSync(file)) {
      problems.push(`${file}: missing`);
      continue;
    }
    const info = pngInfo(file);
    const label = file.slice(ROOT.length + 1);
    if (info.width !== width || info.height !== height) {
      problems.push(`${label}: expected ${width}×${height}, got ${info.width}×${info.height}`);
    }
    if (info.hasAlpha) problems.push(`${label}: has an alpha channel (store requires opaque PNG)`);
    console.log(`  ${label}  ${info.width}×${info.height}  alpha=${info.hasAlpha}`);
  }
  if (problems.length > 0) throw new Error(`asset check failed:\n  ${problems.join("\n  ")}`);
}

async function main() {
  if (!existsSync(resolve(DIST, "manifest.json"))) {
    throw new Error("dist/ is not built. Run `bun run build` first.");
  }
  mkdirSync(SHOTS_DIR, { recursive: true });
  mkdirSync(PROMO_DIR, { recursive: true });

  const { chromium } = loadPlaywright();
  const { server, state } = startServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const context = await chromium.launchPersistentContext(
    mkdtempSync(join(tmpdir(), "atmapper-store-")),
    {
      channel: "chromium",
      headless: false,
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--hide-crash-restore-bubble",
      ],
    },
  );

  try {
    // Give the popup page a realistic host badge instead of the extension id.
    await context.addInitScript(() => {
      const api = globalThis.chrome;
      if (!api?.tabs || api.tabs.__atmPatched) return;
      api.tabs.query = async () => [{ url: "https://mail.google.com/mail/u/0/#inbox" }];
      api.tabs.__atmPatched = true;
    });

    const sw = await getServiceWorker(context);
    const extId = new URL(sw.url()).host;
    await sw.evaluate(
      async ({ mappings, settings, overrides }) => {
        await chrome.storage.local.set({ atm_mappings: mappings });
        await chrome.storage.sync.set({ atm_settings: settings, atm_site_overrides: overrides });
      },
      { mappings: MAPPINGS, settings: SETTINGS, overrides: SITE_OVERRIDES },
    );

    // The toolbar popup, captured on its own so it can be staged at full size.
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 900, height: 900 });
    await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup.waitForFunction(
      () => document.querySelectorAll("#mappingsList .mapping").length >= 5,
      null,
      { timeout: 8000 },
    );
    await popup.waitForFunction(
      () => document.getElementById("hostBadge")?.textContent === "mail.google.com",
      null,
      { timeout: 8000 },
    );
    state.popupPng = await popup.locator("#popup").screenshot({ timeout: 15000 });
    await popup.close();

    // Settings: Mappings then Sites.
    const options = await context.newPage();
    await options.setViewportSize({ width: 1280, height: 800 });
    await options.goto(`chrome-extension://${extId}/options/options.html`);
    await options.waitForFunction(
      () => document.querySelectorAll("#mappings-list .ui-list-row").length >= 5,
      null,
      { timeout: 8000 },
    );
    await options.click("#tab-mappings");
    await options.waitForSelector("#panel-mappings.active");
    await shot(options, join(SHOTS_DIR, "04-mappings.png"));
    await options.click("#tab-sites");
    await options.waitForSelector("#panel-sites.active");
    await shot(options, join(SHOTS_DIR, "05-sites.png"));
    await options.close();

    // Autocomplete in a real editable field, then the inline add form.
    const editor = await context.newPage();
    await editor.setViewportSize({ width: 1280, height: 800 });
    await editor.goto(`${origin}/`);
    await editor.waitForSelector("#editor");
    await editor.click("#editor");
    await editor.keyboard.type("Hi team,\n\nHere is the plan for the launch. @si");
    await editor.waitForSelector("#atm-popup");
    await shot(editor, join(SHOTS_DIR, "01-autocomplete.png"));

    await editor.fill("#editor", "");
    await editor.click("#editor");
    await editor.keyboard.type("One more thing before I send: @fyi");
    await editor.waitForSelector(".atm-popup__add");
    await editor.locator(".atm-popup__add").dispatchEvent("mousedown");
    await editor.waitForSelector(".atm-popup__add-form input");
    await editor
      .locator(".atm-popup__add-form input")
      .type("For your information, I will follow up on Friday.");
    await shot(editor, join(SHOTS_DIR, "02-inline-add.png"));
    await editor.close();

    // Staged popup screenshot.
    const stage = await context.newPage();
    await stage.setViewportSize({ width: 1280, height: 800 });
    await stage.goto(`${origin}/stage-popup.html`);
    await stage.waitForFunction(
      () => {
        const img = document.querySelector("img.popup");
        return Boolean(img?.complete && img.naturalWidth > 0);
      },
      null,
      { timeout: 8000 },
    );
    await shot(stage, join(SHOTS_DIR, "03-popup.png"));
    await stage.close();

    // Promo tiles.
    const promo = await context.newPage();
    await promo.setViewportSize({ width: 440, height: 280 });
    await promo.goto(`${origin}/promo.html?size=small`);
    await promo.waitForFunction(
      () => document.querySelector(".mark")?.textContent === "@",
      null,
      { timeout: 8000 },
    );
    await shot(promo, join(PROMO_DIR, "small-tile-440x280.png"));

    await promo.setViewportSize({ width: 1400, height: 560 });
    await promo.goto(`${origin}/promo.html?size=marquee`);
    await promo.waitForFunction(
      () => {
        const img = document.querySelector("img.popup");
        return Boolean(img?.complete && img.naturalWidth > 0);
      },
      null,
      { timeout: 8000 },
    );
    await shot(promo, join(PROMO_DIR, "marquee-1400x560.png"));
    await promo.close();
  } finally {
    await context.close();
    server.close();
  }

  console.log("Captured store assets:");
  verify();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
