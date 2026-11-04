// Copies src/ to dist/, adds the protected footer, and injects it into every HTML page.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const FOOTER_SRC = path.join(ROOT, "protected", "footer.js");
const FOOTER_PATH = "/_unsupervised/footer.js";
const FOOTER_TAG = `<script src="${FOOTER_PATH}" defer></script>`;
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
// The agent can't claim the footer's path.
await rm(path.join(DIST, "_unsupervised"), { recursive: true, force: true });
await mkdir(path.join(DIST, "_unsupervised"), { recursive: true });
await cp(FOOTER_SRC, path.join(DIST, FOOTER_PATH));

let total = 0;
let pages = 0;
for await (const file of walk(DIST)) {
  const { size } = await stat(file);
  if (size > MAX_BYTES) throw new Error(`${path.relative(DIST, file)} is over 25 MiB`);
  total += size;
  if (!file.endsWith(".html")) continue;
  pages++;
  let html = await readFile(file, "utf8");
  if (!html.includes(FOOTER_TAG)) {
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${FOOTER_TAG}\n</body>`) : `${html}\n${FOOTER_TAG}\n`;
    await writeFile(file, html);
  }
}

if (pages === 0) throw new Error("No HTML pages in src/");
console.log(`Built ${pages} page(s), ${(total / 1024).toFixed(1)} KiB into dist/`);
