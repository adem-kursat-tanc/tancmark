import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-live-lease-race-"));
const root = path.join(temp, "store");
fs.mkdirSync(root);
const moduleUrl = pathToFileURL(path.resolve("artifacts/api-server/src/live/liveProcessLease.ts")).href;

const stalePrimer = `import {acquireLiveProcessLease} from ${JSON.stringify(moduleUrl)};acquireLiveProcessLease(${JSON.stringify(root)});process.stdout.write('PRIMED\\n');`;
const primed = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "-e", stalePrimer], { cwd: process.cwd(), encoding: "utf8", windowsHide: true, timeout: 30_000 });
assert.equal(primed.status, 0, primed.stderr); assert.equal(primed.stdout.trim(), "PRIMED");

async function batch(batchIndex: number, batchSize: number): Promise<{ acquired: number; held: number }> {
  const releaseFile = path.join(temp, `release-${batchIndex}`);
  // codeql[js/bad-code-sanitization] Test-only child source embeds locally generated paths through JSON.stringify, which safely quotes JS string literals.
  const childCode = `import fs from 'node:fs';import {acquireLiveProcessLease} from ${JSON.stringify(moduleUrl)};try{acquireLiveProcessLease(${JSON.stringify(root)});process.stdout.write('ACQUIRED\\n');const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(releaseFile)})){clearInterval(timer);process.exit(0)}},10)}catch(e){if(e instanceof Error&&e.message==='live_storage_process_lease_held'){process.stdout.write('HELD\\n');process.exit(0)}process.stdout.write('ERROR\\n');process.exit(2)}`;
  let reported = 0;
  let released = false;
  const release = (): void => {
    if (!released && reported === batchSize) { released = true; fs.writeFileSync(releaseFile, "release", { flag: "wx" }); }
  };
  const results = await Promise.all(Array.from({ length: batchSize }, () => new Promise<{ output: string; status: number | null }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--no-warnings", "--experimental-strip-types", "-e", childCode], { cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = ""; let counted = false;
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; if (!counted && /^(ACQUIRED|HELD|ERROR)\r?\n/.test(stdout)) { counted = true; reported += 1; release(); } });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ output: stdout.trim(), status: status ?? (stderr ? 2 : null) }));
  })));
  fs.rmSync(releaseFile, { force: true });
  assert.equal(reported, batchSize);
  assert(results.every((result) => result.status === 0), JSON.stringify(results.filter((result) => result.status !== 0).slice(0, 3)));
  const acquired = results.filter((result) => result.output === "ACQUIRED").length;
  const held = results.filter((result) => result.output === "HELD").length;
  assert.equal(acquired, 1); assert.equal(held, batchSize - 1);
  return { acquired, held };
}

async function main(): Promise<void> {
try {
  const failureRoot = path.join(temp, "info-write-failure-store");
  fs.mkdirSync(failureRoot);
  const blockedInfoPath = path.join(failureRoot, ".tancmark-live-process-lease-v2.json");
  fs.mkdirSync(blockedInfoPath);
  const leaseModule = await import(moduleUrl);
  assert.throws(() => leaseModule.acquireLiveProcessLease(failureRoot), /live_storage_process_lease_held/);
  assert.equal(leaseModule.liveProcessLeaseHeldByThisProcess(failureRoot), false, "failed informational write must not leave an in-process lease marker");
  fs.rmSync(blockedInfoPath, { recursive: true });
  const recoveryCode = `import {acquireLiveProcessLease} from ${JSON.stringify(moduleUrl)};acquireLiveProcessLease(${JSON.stringify(failureRoot)});process.stdout.write('RECOVERED\\n');`;
  const recovered = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", "-e", recoveryCode], { cwd: process.cwd(), encoding: "utf8", windowsHide: true, timeout: 30_000 });
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(recovered.stdout.trim(), "RECOVERED");
  assert.equal(leaseModule.liveProcessLeaseHeldByThisProcess(failureRoot), false);
  const batchSize = 101;
  const results = [await batch(1, batchSize), await batch(2, batchSize)];
  console.log(JSON.stringify({ contract: "live_local_product_core_lease_contract", status: "passed", authority: "SQLITE_OS_EXCLUSIVE_LOCK", informationalWriteFailureFailClosed: true, failedAcquireClearsInProcessMarker: true, recoveryAfterFailure: true, stalePrimerReleasedByOs: true, batches: results.map((result, index) => ({ batch: index + 1, contenders: batchSize, ...result })), exactOneAcquiredEachBatch: true }, null, 2));
} finally {
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(temp)); assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative)); fs.rmSync(temp, { recursive: true, force: true });
}
}

void main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
