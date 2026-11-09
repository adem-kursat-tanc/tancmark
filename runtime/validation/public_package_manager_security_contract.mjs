// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { verifyNpmPackage } from "./public_package_manager_security_gate.mjs";

const version = "10.34.5";
const bytes = Buffer.from("deterministic package verification fixture");
const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const shasum = createHash("sha1").update(bytes).digest("hex");
const tarball = "https://registry.npmjs.org/pnpm/-/pnpm-10.34.5.tgz";
const expected = { integrity, shasum };
const metadata = {
  version,
  license: "MIT",
  dist: { integrity, shasum, tarball, signatures: [{ keyid: "fixture", sig: "fixture" }] },
};

// A newly published version must not invalidate a still-safe pinned release.
// No mutable dist-tag lookup is permitted by either the helper or its caller.
const source = readFileSync(new URL("./public_package_manager_security_gate.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /get\("https:\/\/registry\.npmjs\.org\/pnpm"\)/);
assert.doesNotMatch(source, /\["dist-tags"\]/);
const requests = [];
const getSource = async (url, kind) => {
  requests.push([url, kind]);
  if (url === `https://registry.npmjs.org/pnpm/${version}`) return structuredClone(metadata);
  if (url === tarball && kind === "bytes") return bytes;
  throw new Error(`unexpected_registry_lookup:${url}`);
};
const result = await verifyNpmPackage("pnpm", version, expected, getSource);
assert.equal(result.tarballBytes, bytes.length);
assert.deepEqual(requests, [[`https://registry.npmjs.org/pnpm/${version}`, undefined], [tarball, "bytes"]]);

// Pin and integrity mismatches, unsigned metadata, and network failures still fail closed.
for (const mutate of [
  (entry) => { entry.version = "10.34.9"; },
  (entry) => { entry.dist.integrity = "sha512-mismatch"; },
  (entry) => { entry.dist.shasum = "mismatch"; },
  (entry) => { entry.dist.signatures = []; },
]) {
  const changed = structuredClone(metadata);
  mutate(changed);
  await assert.rejects(() => verifyNpmPackage("pnpm", version, expected,
    async (url) => url === tarball ? bytes : changed));
}
await assert.rejects(() => verifyNpmPackage("pnpm", version, expected,
  async (url) => url === tarball ? Buffer.from("tampered tarball") : metadata));
await assert.rejects(() => verifyNpmPackage("pnpm", version, expected,
  async () => { throw new Error("network_unavailable"); }), /network_unavailable/);

process.stdout.write(`${JSON.stringify({ gate: "PUBLIC_PACKAGE_MANAGER_SECURITY_CONTRACT", status: "PASSED" })}\n`);
