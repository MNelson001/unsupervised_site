// Claims the next batch from the control plane and writes batch.json.
import { appendFile, writeFile } from "node:fs/promises";

const { CONTROL_URL, RUNNER_SECRET, GITHUB_OUTPUT } = process.env;
if (!CONTROL_URL || !RUNNER_SECRET) throw new Error("CONTROL_URL and RUNNER_SECRET are required");

const res = await fetch(`${CONTROL_URL}/api/runner/claim`, {
  method: "POST",
  headers: { authorization: `Bearer ${RUNNER_SECRET}` },
});
if (!res.ok) throw new Error(`claim failed: ${res.status} ${await res.text()}`);
const batch = await res.json();

const hasChanges = Boolean(batch.batchId) && batch.changes.length > 0;
if (hasChanges) {
  const forAgent = batch.changes.map(({ id, text, createdAt }) => ({ id, text, createdAt }));
  await writeFile("batch.json", JSON.stringify({ batchId: batch.batchId, changes: forAgent }, null, 2));
}

console.log(hasChanges ? `Claimed batch ${batch.batchId} with ${batch.changes.length} change(s)` : "Nothing queued");
if (GITHUB_OUTPUT) {
  await appendFile(GITHUB_OUTPUT, `has_changes=${hasChanges}\nbatch_id=${batch.batchId ?? ""}\n`);
}
