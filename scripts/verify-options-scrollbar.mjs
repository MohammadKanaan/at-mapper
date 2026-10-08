/**
 * Real-browser check for the settings page layout shift.
 *
 * Switching tabs changes the page height, so a tall panel (Sites, Mappings)
 * makes the document scrollable. Without a reserved scrollbar track the
 * centered `.container` jumps sideways by half the scrollbar width.
 *
 * This serves the built `dist/` folder, seeds enough items to make the panels
 * scroll, then measures `.container` on every tab. It fails if the container
 * moves or if the scrollbar track is not reserved from the start.
 *
 * Playwright is not a project dependency (it is heavy and needs browser
 * downloads), so this is a manual check, not part of `bun test`:
 *
 *   bun run build
 *   node scripts/verify-options-scrollbar.mjs
 *
 * Install Playwright first if needed:
 *   bun add -d playwright && bunx playwright install chromium
 */
/* global document, window -- used inside page.evaluate() callbacks that run in the browser. */
import http from "node:http";
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

async function loadChromium() {
  const candidates = ["playwright"];
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    candidates.push(pathToFileURL(join(globalRoot, "playwright", "index.mjs")).href);
  } catch {
    // npm not available; fall through to the bare specifier only.
  }
  for (const specifier of candidates) {
    try {
      const mod = await import(specifier);
      if (mod.chromium) return mod.chromium;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    "Playwright not found. Install it with `bun add -d playwright && bunx playwright install chromium`.",
  );
}

/** Prefer $PW_CHROME, else the newest installed headless shell (revision may differ from the package's). */
function findExecutable() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const dirs = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), "Library", "Caches", "ms-playwright"),
    join(homedir(), ".cache", "ms-playwright"),
  ].filter(Boolean);
  const found = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort().reverse()) {
      if (!entry.startsWith("chromium_headless_shell-")) continue;
      for (const rel of [
        ["chrome-headless-shell-mac-arm64", "chrome-headless-shell"],
        ["chrome-headless-shell-mac-x64", "chrome-headless-shell"],
        ["chrome-headless-shell-linux64", "chrome-headless-shell"],
        ["chrome-headless-shell-win64", "chrome-headless-shell.exe"],
      ]) {
        found.push(join(dir, entry, ...rel));
      }
    }
  }
  return found.find((p) => existsSync(p));
}

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = resolve(dist, `.${pathname === "/" ? "/options/options.html" : pathname}`);
      if (!file.startsWith(dist)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

/** Seed storage so the Sites and Mappings panels overflow the viewport. */
function seedScript() {
  const siteOverrides = {};
  for (let i = 0; i < 60; i++) siteOverrides[`site-${String(i).padStart(2, "0")}.example.com`] = i % 2 === 0;
  const mappings = {};
  for (let i = 0; i < 60; i++) mappings[`key${i}`] = `value ${i}`;
  const settings = { trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "light" };
  return `(() => {
    const store = {
      local: { atm_mappings: ${JSON.stringify(mappings)} },
      sync: { atm_settings: ${JSON.stringify(settings)}, atm_site_overrides: ${JSON.stringify(siteOverrides)} },
    };
    const area = (name) => ({
      get: async (key) => {
        const keys = typeof key === "string" ? [key] : Array.isArray(key) ? key : Object.keys(key || {});
        const out = {};
        for (const k of keys) if (k in store[name]) out[k] = store[name][k];
        return out;
      },
      set: async (obj) => Object.assign(store[name], obj),
    });
    globalThis.__atm_chrome = {
      storage: {
        local: area("local"),
        sync: area("sync"),
        onChanged: { addListener() {}, removeListener() {} },
      },
      runtime: { getManifest: () => ({ version: "1.0.0" }) },
    };
  })();`;
}

const chromium = await loadChromium();
const server = await startServer();
const { port } = server.address();

// Playwright hides scrollbars by default; this bug needs a layout scrollbar.
const browser = await chromium.launch({
  executablePath: findExecutable(),
  ignoreDefaultArgs: ["--hide-scrollbars"],
});
const context = await browser.newContext({ viewport: { width: 1000, height: 950 } });
await context.addInitScript(seedScript());
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${port}/options/options.html`, { waitUntil: "networkidle" });
await page.waitForSelector("#sites-count");
await page.waitForTimeout(150);

const sample = () =>
  page.evaluate(() => {
    const r = document.querySelector(".container").getBoundingClientRect();
    return {
      x: +r.x.toFixed(2),
      width: +r.width.toFixed(2),
      scrollbar: window.innerWidth - document.documentElement.clientWidth,
    };
  });

const tabs = ["general", "sites", "mappings", "data"];
const results = {};
for (const tab of tabs) {
  await page.click(`#tab-${tab}`);
  await page.waitForTimeout(200);
  results[tab] = await sample();
}

await browser.close();
server.close();

console.log(JSON.stringify(results, null, 2));

const xs = tabs.map((t) => results[t].x);
const widths = tabs.map((t) => results[t].width);
const spreadX = +(Math.max(...xs) - Math.min(...xs)).toFixed(2);
const spreadWidth = +(Math.max(...widths) - Math.min(...widths)).toFixed(2);
const trackReserved = tabs.every((t) => results[t].scrollbar > 0);

console.log(`\ncontainer x spread: ${spreadX}px (want 0)`);
console.log(`container width spread: ${spreadWidth}px (want 0)`);
console.log(`scrollbar track reserved on every tab: ${trackReserved}`);

if (spreadX !== 0 || spreadWidth !== 0 || !trackReserved) {
  console.error("\nFAIL: settings page shifts when switching to a scrollable tab");
  process.exit(1);
}
console.log("\nPASS: no layout shift across tabs");
