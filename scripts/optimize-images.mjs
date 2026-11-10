// Converts every JPG/PNG in public/assets/img to a resized .webp twin.
// The server (seo.js) automatically serves the .webp to browsers that support it,
// so no references in code or in the database need to change.
//
//   npm i -D sharp
//   node scripts/optimize-images.mjs
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('public/assets/img');
const MAX_WIDTH = 1600;
let before = 0, after = 0;

for (const f of await readdir(DIR)) {
  if (!/\.(jpe?g|png)$/i.test(f)) continue;
  const src = path.join(DIR, f);
  const out = src.replace(/\.(jpe?g|png)$/i, '.webp');
  const img = sharp(src);
  const { width, hasAlpha } = await img.metadata();
  await img
    .resize({ width: Math.min(width, MAX_WIDTH), withoutEnlargement: true })
    .webp({ quality: hasAlpha ? 85 : 78, alphaQuality: 90, effort: 5 })
    .toFile(out);
  const a = (await stat(src)).size, b = (await stat(out)).size;
  before += a; after += b;
  console.log(`${f.padEnd(42)} ${(a / 1024).toFixed(0).padStart(5)} KB → ${(b / 1024).toFixed(0).padStart(5)} KB`);
}
console.log(`\nTotal ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
