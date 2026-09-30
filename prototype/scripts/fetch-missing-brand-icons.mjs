/* Try the seven storefronts not indexed by the public favicon service. */
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const directory = join(root, 'assets', 'brand-icons');
const manifestPath = join(directory, 'sources.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const extensions = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/svg+xml': 'svg'};
const fetchImage = async (url) => {
  const response = await fetch(url, {signal: AbortSignal.timeout(10000), headers: {'user-agent': 'Mozilla/5.0 (compatible; TheBetterWardrobeIconReview/1.0)'}});
  const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const extension = extensions[mime];
  if (!response.ok || !extension || response.url.includes('/shopifycloud/storefront/assets/favicon-')) throw new Error(`No brand icon: ${response.status} ${mime}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 200_000) throw new Error('Unexpected image size');
  return {bytes, extension, url: response.url};
};
for (const item of manifest.filter((entry) => !entry.file)) {
  const base = new URL(item.site);
  const candidates = [];
  try {
    const response = await fetch(base, {signal: AbortSignal.timeout(10000), headers: {'user-agent': 'Mozilla/5.0'}});
    const html = await response.text();
    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || '';
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
      if (/icon/i.test(rel) && href) candidates.push(new URL(href, response.url).href);
    }
  } catch {}
  candidates.push(new URL('/favicon.ico', base).href, new URL('/favicon.png', base).href, new URL('/apple-touch-icon.png', base).href);
  for (const candidate of [...new Set(candidates)]) {
    try {
      const image = await fetchImage(candidate);
      const filename = `${item.id}.${image.extension}`;
      writeFileSync(join(directory, filename), image.bytes);
      item.file = `assets/brand-icons/${filename}`;
      item.iconSource = image.url;
      item.sha256 = createHash('sha256').update(image.bytes).digest('hex');
      delete item.error;
      process.stdout.write(`✓ ${item.id} ${item.name}: ${image.url}\n`);
      break;
    } catch {}
  }
  if (!item.file) process.stdout.write(`! ${item.id} ${item.name}: no verified icon found\n`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(root, 'brand-icon-map.js'), `/* Generated from brand-icons/sources.json. */\nwindow.BrandIconMap = ${JSON.stringify(Object.fromEntries(manifest.filter((entry) => entry.file).map((entry) => [entry.id, entry.file])))};\n`);
