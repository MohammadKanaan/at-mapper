/** Generate all extension icon sizes from the shared SVG artwork. */
import sharp from "sharp";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICONS_DIR = resolve(fileURLToPath(import.meta.url), "..", "..", "icons");
const SIZES = [16, 32, 48, 128];

for (const size of SIZES) {
  // Rasterize above the target resolution, then downsample for smooth small icons.
  await sharp(resolve(ICONS_DIR, "logo.svg"), { density: 288 })
    .resize(size, size)
    .png()
    .toFile(resolve(ICONS_DIR, `icon-${size}.png`));
  console.log(`icons/icon-${size}.png generated`);
}
