// Runs after the agent. Reverts anything outside src/, refuses to ship leaked secrets,
// and normalizes batch-result.json so every change in the batch has a status.
import { execFileSync } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const ALLOWED = (file) => file.startsWith("src/") || file === "batch-result.json" || file === "batch.json";

// 1. Revert tracked edits and delete new files outside src/.
const changed = git("diff", "--name-only", "HEAD").split("\n").filter(Boolean);
for (const file of changed.filter((f) => !ALLOWED(f))) {
  console.log(`reverting ${file}`);
  git("checkout", "HEAD", "--", file);
}
const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
for (const file of untracked.filter((f) => !ALLOWED(f))) {
  console.log(`removing ${file}`);
  await rm(file, { force: true, recursive: true });
}

// 2. Never publish secrets. Check known values and common key shapes.
const secretValues = (process.env.GUARD_SECRETS ?? "").split(",").map((s) => s.trim()).filter((s) => s.length >= 8);
const secretShapes = [/sk-ant-[A-Za-z0-9_-]{10,}/, /gh[opsu]_[A-Za-z0-9]{20,}/, /whsec_[A-Za-z0-9]{10,}/, /sk_live_[A-Za-z0-9]{10,}/];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}
for await (const file of walk("src")) {
  const text = await readFile(file, "latin1");
  if (secretValues.some((v) => text.includes(v)) || secretShapes.some((re) => re.test(text))) {
    throw new Error(`Refusing to ship: ${file} contains something that looks like a secret`);
  }
}

// 3. Normalize results: every change gets exactly one status.
const batch = JSON.parse(await readFile("batch.json", "utf8"));
let reported = [];
try {
  reported = JSON.parse(await readFile("batch-result.json", "utf8"));
  if (!Array.isArray(reported)) reported = [];
} catch {
  console.log("batch-result.json missing or invalid; marking every change failed");
}
const byId = new Map(reported.filter((r) => r && typeof r.id === "string").map((r) => [r.id, r]));
const results = batch.changes.map(({ id }) => {
  const r = byId.get(id);
  const status = r?.status === "implemented" ? "implemented" : "failed";
  const note = typeof r?.note === "string" ? r.note.slice(0, 1000) : "Not built in this batch.";
  return { id, status, note };
});
await writeFile("batch-result.json", JSON.stringify(results, null, 2));

const built = results.filter((r) => r.status === "implemented").length;
console.log(`${built}/${results.length} change(s) reported as built`);
