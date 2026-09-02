import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const LEASE_DATABASE = ".tancmark-live-process-lease-v2.sqlite";
const LEASE_INFO = ".tancmark-live-process-lease-v2.json";
const leases = new Map<string, DatabaseSync>();
const key = (root: string): string => process.platform === "win32" ? path.resolve(root).toLowerCase() : path.resolve(root);

/** SQLite's EXCLUSIVE transaction is the cross-process authority and is released by the OS on crash. */
export function acquireLiveProcessLease(storageRoot: string): void {
  const leaseKey = key(storageRoot);
  if (leases.has(leaseKey)) return;
  const databasePath = path.join(storageRoot, LEASE_DATABASE);
  let database: DatabaseSync | null = null;
  let temporaryInfoPath: string | null = null;
  try {
    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA busy_timeout=0; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS live_process_lease(schema_version TEXT NOT NULL, pid INTEGER NOT NULL, acquired_at TEXT NOT NULL); DELETE FROM live_process_lease;");
    database.prepare("INSERT INTO live_process_lease(schema_version,pid,acquired_at) VALUES(?,?,?)").run("tancmark-live-process-lease-v2", process.pid, new Date().toISOString());
    leases.set(leaseKey, database);
    const info = path.join(storageRoot, LEASE_INFO);
    temporaryInfoPath = `${info}.tmp-${randomUUID()}`;
    fs.writeFileSync(temporaryInfoPath, `${JSON.stringify({ schemaVersion: "tancmark-live-process-lease-v2", pid: process.pid, acquiredAt: new Date().toISOString(), authority: "SQLITE_OS_EXCLUSIVE_LOCK" })}\n`, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporaryInfoPath, info);
    temporaryInfoPath = null;
  } catch {
    if (leases.get(leaseKey) === database) leases.delete(leaseKey);
    try { database?.close(); } catch { /* best-effort close after failed acquire */ }
    if (temporaryInfoPath) {
      try { fs.rmSync(temporaryInfoPath, { force: true }); } catch { /* fail-closed; caller receives the lease error */ }
    }
    throw new Error("live_storage_process_lease_held");
  }
}

export function liveProcessLeaseHeldByThisProcess(storageRoot: string): boolean { return leases.has(key(storageRoot)); }

/** Test-only deterministic teardown for isolated temporary roots. Product runtime holds its lease until process exit. */
export function releaseLiveProcessLeasesForContractOnly(): void {
  for (const database of leases.values()) {
    try { database.exec("ROLLBACK"); } catch { /* already released */ }
    try { database.close(); } catch { /* already closed */ }
  }
  leases.clear();
}
