/**
 * Real-browser check for replacing a token inside a multi-line contenteditable.
 *
 * Token detection reads the text before the caret with a "\n" for each line
 * break or block boundary. The replacement must land exactly on the token,
 * whatever lines sit above or below it. When it drifts, "@a" stays in place,
 * the replacement goes in after it, and text from the next line is deleted
 * (INN-132).
 *
 * This serves the built `dist/` folder, places the caret after "@a" in each
 * fixture, runs getTokenBeforeCaret + replaceToken, and compares the editor's
 * HTML with the expected result.
 *
 * Playwright is not a project dependency, so this is a manual check, not part
 * of `bun test`:
 *
 *   bun run build
 *   node scripts/verify-contenteditable-replace.mjs
 *
 * Install Playwright first if needed:
 *   bun add -d playwright && bunx playwright install chromium
 */
/* global document, window, NodeFilter -- used inside page.evaluate() callbacks that run in the browser. */
import http from "node:http";
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end('<!doctype html><body><div id="ed" contenteditable="true"></div></body>');
        return;
      }
      const file = resolve(dist, `.${pathname}`);
      if (!file.startsWith(dist)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, { "content-type": "text/javascript" });
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

const REPLACEMENT = "[[Android]]";

/** Each fixture has exactly one "@a"; the caret goes right after it. */
const CASES = [
  {
    name: "single paragraph, mid-text",
    html: "<p>see @a here</p>",
    want: `<p>see ${REPLACEMENT} here</p>`,
  },
  {
    name: "one paragraph above",
    html: "<p>first line</p><p>see @a here</p>",
    want: `<p>first line</p><p>see ${REPLACEMENT} here</p>`,
  },
  {
    name: "paragraphs above and below",
    html: "<p>first line</p><p>second line</p><p>see @a</p><p>below line</p>",
    want: `<p>first line</p><p>second line</p><p>see ${REPLACEMENT}</p><p>below line</p>`,
  },
  {
    name: "empty paragraph above",
    html: "<p>first</p><p><br></p><p>see @a here</p>",
    want: `<p>first</p><p><br></p><p>see ${REPLACEMENT} here</p>`,
  },
  {
    name: "<br>-separated lines",
    html: "first<br>second<br>see @a here",
    want: `first<br>second<br>see ${REPLACEMENT} here`,
  },
  {
    name: "token split across inline elements",
    html: "<p>first line</p><p>see <b>@</b>a here</p>",
    // insertText keeps the first character's <b> and may emit &nbsp;, so compare text.
    wantText: `first line|see ${REPLACEMENT} here`,
  },
];

const chromium = await loadChromium();
const server = await startServer();
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ executablePath: findExecutable() });
const page = await browser.newPage();
await page.goto(`${base}/`);

let failed = 0;
for (const c of CASES) {
  const got = await page.evaluate(
    async ({ html, base, replacement }) => {
      const { getTokenBeforeCaret, replaceToken } = await import(`${base}/text.js`);
      const ed = document.getElementById("ed");
      ed.innerHTML = html;
      ed.focus();
      // Caret goes after the "a" that follows the "@" (possibly in another text node).
      const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
      let sawTrigger = false;
      let n;
      while ((n = walker.nextNode())) {
        const at = n.data.indexOf("@");
        const from = sawTrigger ? 0 : at + 1;
        if (at >= 0) sawTrigger = true;
        if (!sawTrigger) continue;
        const a = n.data.indexOf("a", from);
        if (a < 0) continue;
        const r = document.createRange();
        r.setStart(n, a + 1);
        r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        break;
      }
      const token = getTokenBeforeCaret(ed, "contenteditable", "@");
      if (!token) return { error: "no token detected" };
      const ok = replaceToken(ed, "contenteditable", token, replacement);
      const text = [...ed.children].map((p) => p.textContent.replace(/\u00a0/g, " ")).join("|");
      return { ok, html: ed.innerHTML, text };
    },
    { html: c.html, base, replacement: REPLACEMENT },
  );

  const pass = !got.error && got.ok && (c.wantText ? got.text === c.wantText : got.html === c.want);
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${c.name}`);
  if (!pass) {
    console.log(`      before: ${c.html}`);
    console.log(`      want:   ${c.wantText ?? c.want}`);
    console.log(`      got:    ${got.error ?? (c.wantText ? got.text : got.html)}${got.ok === false ? " (replaceToken returned false)" : ""}`);
  }
}

await browser.close();
server.close();

if (failed > 0) {
  console.error(`\nFAIL: ${failed}/${CASES.length} contenteditable replacements landed in the wrong place`);
  process.exit(1);
}
console.log(`\nPASS: all ${CASES.length} contenteditable replacements landed on the token`);
