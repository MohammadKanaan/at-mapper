/**
 * Package dist/ into an installable archive.
 *
 * Both stores want a plain zip with manifest.json at the archive root, not a
 * folder of files:
 *   - addons.mozilla.org only accepts .zip, .xpi or .crx, and answers
 *     "Your add-on should end with .zip, .xpi or .crx" for anything else.
 *     Firefox installs the same archive when it is named .xpi.
 *   - The Chrome Web Store wants a .zip.
 *
 * Run the matching build first (bun run build:firefox / bun run build).
 *
 * Usage: node scripts/package.mjs [--target=chrome|firefox]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const dist = resolve(root, "dist");
const outDir = resolve(root, "artifacts");

const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const target =
  targetArg?.slice("--target=".length) ?? process.env.TARGET ?? "chrome";

const EXTENSION = { chrome: "zip", firefox: "xpi" };
if (!(target in EXTENSION)) {
  console.error(
    `package failed: unknown target "${target}" (expected chrome or firefox)`,
  );
  process.exit(1);
}

const manifestPath = resolve(dist, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(
    `package failed: ${manifestPath} not found — run the ${target} build first`,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// dist/ keeps whichever manifest the last build wrote, so catch a stale or
// mismatched build before it becomes an add-on the store rejects.
const isFirefoxManifest = Array.isArray(manifest.background?.scripts);
if (target === "firefox" && !isFirefoxManifest) {
  console.error(
    "package failed: dist/ was built for Chrome — run `bun run build:firefox` first",
  );
  process.exit(1);
}
if (target === "chrome" && isFirefoxManifest) {
  console.error(
    "package failed: dist/ was built for Firefox — run `bun run build` first",
  );
  process.exit(1);
}

const slug = manifest.name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const archive = resolve(
  outDir,
  `${slug}-${manifest.version}-${target}.${EXTENSION[target]}`,
);

try {
  mkdirSync(outDir, { recursive: true });
  rmSync(archive, { force: true });
  // -X drops macOS' extra file attributes; archive contents are relative to
  // dist/ so manifest.json lands at the root of the zip.
  execFileSync("zip", ["-r", "-X", "-q", archive, "."], {
    cwd: dist,
    stdio: "inherit",
  });
} catch (err) {
  console.error(`package failed: ${err.message}`);
  process.exit(1);
}

console.log(`packaged ${archive}`);
