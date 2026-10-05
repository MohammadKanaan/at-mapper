/**
 * Copy static (non-TS) assets into dist/ after tsc runs.
 * Keeps dist/ self-contained so it can be loaded unpacked as-is.
 *
 * `--target=firefox` (or TARGET=firefox in the environment) swaps in a
 * Firefox-compatible manifest that adds background.scripts (Firefox MV3 uses
 * scripts, not service_worker).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const dist = resolve(root, "dist");

const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const target = targetArg?.slice("--target=".length) ?? process.env.TARGET ?? "chrome";

/** Files and folders copied verbatim, relative to the repo root -> dist/. */
const STATIC_ASSETS = [
  { from: "icons", to: "icons" },
  { from: "src/popup/popup.html", to: "popup/popup.html" },
  { from: "src/popup/popup.css", to: "popup/popup.css" },
  { from: "src/options/options.html", to: "options/options.html" },
  { from: "src/options/options.css", to: "options/options.css" },
  { from: "src/ui/styles", to: "ui/styles" },
];

function buildManifest() {
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
  if (target === "firefox") {
    const { service_worker: _serviceWorker, type: _type, ...background } = manifest.background;
    manifest.background = { ...background, scripts: ["background.js"] };
  }
  return manifest;
}

try {
  mkdirSync(dist, { recursive: true });
  writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(buildManifest(), null, 2) + "\n");
  for (const { from, to } of STATIC_ASSETS) {
    cpSync(resolve(root, from), resolve(dist, to), { recursive: true, force: true });
  }
} catch (err) {
  console.error(`copy-static failed: ${err.message}`);
  process.exit(1);
}

console.log(`static assets copied to dist/ (target: ${target})`);
