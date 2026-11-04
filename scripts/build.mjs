// Copies src/ to dist/, adds the protected footer and icons, and injects them into every HTML page.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const PROTECTED = path.join(ROOT, "protected");
const FOOTER_PATH = "/_unsupervised/footer.js";
const FOOTER_TAG = `<script src="${FOOTER_PATH}" defer></script>`;
// Added last in <head> so they win over any icon a change adds.
const ICON_TAGS = [
  `<link rel="icon" href="/favicon.ico" sizes="48x48">`,
  `<link rel="icon" type="image/png" href="/_unsupervised/icon.png">`,
  `<link rel="apple-touch-icon" href="/_unsupervised/apple-touch-icon.png">`,
].join("\n");
const MAX_BYTES = 25 * 1024 * 1024; // Cloudflare Pages caps single files at 25 MiB.

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

await rm(DIST, { recursive: true, force: true });
await cp(SRC, DIST, { recursive: true });
// The agent can't claim the footer's or the icons' paths.
await rm(path.join(DIST, "_unsupervised"), { recursive: true, force: true });
await mkdir(path.join(DIST, "_unsupervised"), { recursive: true });
await cp(path.join(PROTECTED, "footer.js"), path.join(DIST, FOOTER_PATH));
await cp(path.join(PROTECTED, "icons", "icon.png"), path.join(DIST, "_unsupervised", "icon.png"));
await cp(path.join(PROTECTED, "icons", "apple-touch-icon.png"), path.join(DIST, "_unsupervised", "apple-touch-icon.png"));
await cp(path.join(PROTECTED, "icons", "favicon.ico"), path.join(DIST, "favicon.ico"));

let total = 0;
let pages = 0;
for await (const file of walk(DIST)) {
  const { size } = await stat(file);
  if (size > MAX_BYTES) throw new Error(`${path.relative(DIST, file)} is over 25 MiB`);
  total += size;
  if (!file.endsWith(".html")) continue;
  pages++;
  let html = await readFile(file, "utf8");
  if (!html.includes(ICON_TAGS)) {
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${ICON_TAGS}\n</head>`) : `${ICON_TAGS}\n${html}`;
  }
  if (!html.includes(FOOTER_TAG)) {
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${FOOTER_TAG}\n</body>`) : `${html}\n${FOOTER_TAG}\n`;
  }
  await writeFile(file, html);
}

if (pages === 0) throw new Error("No HTML pages in src/");
console.log(`Built ${pages} page(s), ${(total / 1024).toFixed(1)} KiB into dist/`);
