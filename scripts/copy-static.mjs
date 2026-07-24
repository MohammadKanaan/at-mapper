/**
 * Copy static (non-TS) assets into dist/ after tsc runs.
 * Keeps dist/ self-contained so it can be loaded unpacked as-is.
 *
 * TARGET=firefox (env) swaps in a Firefox-compatible manifest that adds
 * background.scripts (Firefox MV3 uses scripts, not service_worker).
 */
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

let manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));

if (process.env.TARGET === "firefox") {
  manifest.background = {
    ...manifest.background,
    scripts: ["background.js"],
  };
  delete manifest.background.service_worker;
  delete manifest.background.type;
}

writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
cpSync(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true, force: true });
cpSync(resolve(root, "src", "popup", "popup.html"), resolve(dist, "popup", "popup.html"), { force: true });
cpSync(resolve(root, "src", "popup", "popup.css"), resolve(dist, "popup", "popup.css"), { force: true });
cpSync(resolve(root, "src", "options", "options.html"), resolve(dist, "options", "options.html"), { force: true });
cpSync(resolve(root, "src", "options", "options.css"), resolve(dist, "options", "options.css"), { force: true });

console.log(`static assets copied to dist/ (target: ${process.env.TARGET ?? "chrome"})`);