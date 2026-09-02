// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  exactFile,
  installVerifiedBinaryAtFixedPath,
  readVerifiedSingleEntryArchive,
} from "./verified-single-entry-archive.mjs";

const VERSION = "0.9.1";
const RELEASE_BASE = "https://github.com/contentauth/c2pa-js/releases/download/%40contentauth/c2pa-node%400.9.1";
const PLATFORMS = Object.freeze({
  "darwin-arm64": {
    target: "aarch64-apple-darwin",
    archiveSha256: "1e09598bb9c6cac51eb44cc7db4e7e8278ac59f1ded6795fa9f84f5a6055c700",
    archiveBytes: 13666364,
    binarySha256: "689f7327631e036533131b36bae7896736adb7aaab0e6a9644555c8a8a073d4b",
    binaryBytes: 38891728,
  },
  "linux-arm64": {
    target: "aarch64-unknown-linux-gnu",
    archiveSha256: "a73c401fdb1a1a9a1f4b811422cd1260e006aec2215bcf949caecf9c239caf3a",
    archiveBytes: 15189032,
    binarySha256: "f7fd592f0e3dab3a82675ea7c9c52df35af73cfda550e3d286774936ffc39729",
    binaryBytes: 43261704,
  },
  "darwin-x64": {
    target: "x86_64-apple-darwin",
    archiveSha256: "b6d1780d3fee2cd9d84e42ff936943f179d0ffabbb785c65531bd6765b595dd8",
    archiveBytes: 15364629,
    binarySha256: "3d846fac4a140f35481324ca4d6809b059aa986ebb3beec5681541743480e19f",
    binaryBytes: 45438668,
  },
  "win32-x64": {
    target: "x86_64-pc-windows-msvc",
    archiveSha256: "e7f7fb615390878f9c65a3a60641136f1d4ca1aab51202b874c44ab8f0264a19",
    archiveBytes: 14118846,
    binarySha256: "dcfdf252a2bd3e6e048e209b0d8ca1733cb3ced0c2462da242906a31b9c941ce",
    binaryBytes: 41728000,
  },
  "linux-x64": {
    target: "x86_64-unknown-linux-gnu",
    archiveSha256: "eb679c2f38575df622d105b7fac0c39e128473394b1e4475a1c1a9ecba11b2fd",
    archiveBytes: 16940149,
    binarySha256: "36864ff24670e6c58132748a783465674f3e8bcd92e9c85e54f3ce7ebce4846c",
    binaryBytes: 49538192,
  },
});

async function archiveBytes(profile) {
  const localArchive = process.env.TANCMARK_C2PA_NATIVE_ARCHIVE;
  if (localArchive) {
    if (!path.isAbsolute(localArchive)) throw new Error("c2pa_native_archive_path_must_be_absolute");
    return { bytes: await readFile(localArchive), source: "OWNER_SUPPLIED_OFFLINE_ARCHIVE" };
  }
  if (process.argv.includes("--offline")) throw new Error("c2pa_native_offline_archive_required");
  const fileName = `c2pa-node_${profile.target}-v${VERSION}.zip`;
  const response = await fetch(`${RELEASE_BASE}/${fileName}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
    headers: { "user-agent": "TancMark-C2PA-Verified-Native-Installer/1.0" },
  });
  if (!response.ok) throw new Error(`c2pa_native_download_failed_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, source: "PINNED_OFFICIAL_GITHUB_RELEASE" };
}

export async function main() {
  const platformKey = `${process.platform}-${process.arch}`;
  const profile = PLATFORMS[platformKey];
  if (!profile) throw new Error(`c2pa_native_platform_not_pinned:${platformKey}`);

  const require = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
  const moduleEntry = require.resolve("@contentauth/c2pa-node");
  const targetPath = path.join(path.dirname(moduleEntry), "index.node");
  if (await exactFile(targetPath, profile.binaryBytes, profile.binarySha256)) {
    process.stdout.write(JSON.stringify({ status: "PASSED_EXISTING_VERIFIED", platform: platformKey, binarySha256: profile.binarySha256 }) + "\n");
    return;
  }
  if (process.argv.includes("--verify-only")) throw new Error("c2pa_native_binary_missing_or_hash_mismatch");

  const downloaded = await archiveBytes(profile);
  const binary = await readVerifiedSingleEntryArchive(downloaded.bytes, profile);
  await installVerifiedBinaryAtFixedPath({
    targetPath,
    binary,
    expectedBytes: profile.binaryBytes,
    expectedSha256: profile.binarySha256,
  });
  process.stdout.write(JSON.stringify({
    status: "PASSED_INSTALLED_VERIFIED",
    platform: platformKey,
    archiveSource: downloaded.source,
    archiveSha256: profile.archiveSha256,
    binarySha256: profile.binarySha256,
  }) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
