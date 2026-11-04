// Reports the batch outcome to the control plane.
// Set FAIL_ALL=1 to mark every change failed (their tokens are returned).
import { readFile } from "node:fs/promises";

const { CONTROL_URL, RUNNER_SECRET, COMMIT_SHA, FAIL_ALL } = process.env;
if (!CONTROL_URL || !RUNNER_SECRET) throw new Error("CONTROL_URL and RUNNER_SECRET are required");

const batch = JSON.parse(await readFile("batch.json", "utf8"));
let results = [];
if (!FAIL_ALL) {
  try {
    results = JSON.parse(await readFile("batch-result.json", "utf8"));
  } catch {
    results = [];
  }
}
if (FAIL_ALL) {
  results = batch.changes.map(({ id }) => ({ id, status: "failed", note: "The build failed, so nothing from this batch shipped." }));
}

const res = await fetch(`${CONTROL_URL}/api/runner/report`, {
  method: "POST",
  headers: { authorization: `Bearer ${RUNNER_SECRET}`, "content-type": "application/json" },
  body: JSON.stringify({ batchId: batch.batchId, commitSha: FAIL_ALL ? null : COMMIT_SHA || null, results }),
});
if (!res.ok) throw new Error(`report failed: ${res.status} ${await res.text()}`);
console.log(await res.text());
