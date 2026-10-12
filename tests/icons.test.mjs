import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");

test("icon generation scales the SVG artwork at every manifest size", async (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), "at-mapper-icons-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  mkdirSync(resolve(fixture, "scripts"));
  mkdirSync(resolve(fixture, "icons"));
  symlinkSync(
    resolve(root, "node_modules"),
    resolve(fixture, "node_modules"),
    "junction",
  );
  copyFileSync(
    resolve(root, "scripts/make-icons.mjs"),
    resolve(fixture, "scripts/make-icons.mjs"),
  );
  // A red left half and transparent right half make scaling and alpha observable.
  writeFileSync(
    resolve(fixture, "icons/logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><path fill="#ff0000" d="M0 0h64v128H0z"/></svg>',
  );
  execFileSync(process.execPath, [resolve(fixture, "scripts/make-icons.mjs")], {
    cwd: tmpdir(),
  });

  for (const size of [16, 32, 48, 128]) {
    const { data, info } = await sharp(
      resolve(fixture, `icons/icon-${size}.png`),
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    const left = (Math.floor(size / 2) * size + Math.floor(size / 4)) * 4;
    const right =
      (Math.floor(size / 2) * size + Math.floor((3 * size) / 4)) * 4;
    assert.deepEqual(
      [...data.subarray(left, left + 4)],
      [255, 0, 0, 255],
      `${size}px artwork`,
    );
    assert.equal(data[right + 3], 0, `${size}px transparency`);
  }
});
