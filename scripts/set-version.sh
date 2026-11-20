#!/usr/bin/env bash
#
# set-version.sh — set the extension version across all version sources.
#
# Updates: manifest.json and package.json.
# Then runs `bun run check`, commits, and tags.
#
# Usage:
#   scripts/set-version.sh <version>
#
#   version  required, semver X.Y.Z (e.g. 1.1.0)
#
# Push the tag to trigger the release workflow:
#   git push origin main && git push origin <version>
#
# Example:
#   scripts/set-version.sh 1.1.0
#
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <version>" >&2
  exit 64
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- validate semver ---
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: not a semver (expected X.Y.Z): $VERSION" >&2
  exit 64
fi

# --- require bun (this is a bun project) ---
if ! command -v bun &>/dev/null; then
  echo "error: bun not found on PATH" >&2
  exit 1
fi

# --- bail early if tag already exists (before touching any files) ---
if git -C "$ROOT" rev-parse -q --verify "refs/tags/$VERSION" &>/dev/null; then
  echo "error: tag $VERSION already exists — pick a new version" >&2
  exit 1
fi

# Set the top-level "version" field of a JSON file in place. Only that line is
# rewritten, so the file's own layout (blank lines, inline arrays) survives.
# Top-level means a 2-space indent, which skips package.json's "version" script.
set_version() {
  local file="$1"
  [[ -f "$file" ]] || { echo "error: $file not found" >&2; exit 1; }
  bun -e '
    const fs = require("fs");
    const file = "'"$file"'";
    const src = fs.readFileSync(file, "utf8");
    const re = /^(  "version"\s*:\s*)"[^"]*"/m;
    if ((src.match(new RegExp(re.source, "gm")) || []).length !== 1) {
      console.error("error: expected exactly one top-level \"version\" in " + file);
      process.exit(1);
    }
    const out = src.replace(re, "$1\"'"$VERSION"'\"");
    if (JSON.parse(out).version !== "'"$VERSION"'") {
      console.error("error: failed to set version in " + file);
      process.exit(1);
    }
    fs.writeFileSync(file, out);
  '
  echo "✓ $(basename "$file") → $VERSION"
}

set_version "$ROOT/manifest.json"
set_version "$ROOT/package.json"

echo
echo "Running \`bun run check\`…"
(
  cd "$ROOT"
  bun run check
)

# --- commit + tag ---
git -C "$ROOT" add manifest.json package.json
git -C "$ROOT" commit -m "release: $VERSION"
git -C "$ROOT" tag "$VERSION"
echo "✓ committed and tagged $VERSION"
echo "Push to release:  git push origin main && git push origin $VERSION"
