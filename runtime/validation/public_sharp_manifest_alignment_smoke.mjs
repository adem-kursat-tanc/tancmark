// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const manifestUrl = new URL("../../artifacts/tancmark-demo/package.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestUrl, "utf8"));
const demoRequire = createRequire(manifestUrl);
const sharp = demoRequire("sharp");
assert.equal(manifest.dependencies.sharp, "0.35.5");
assert.equal(sharp.versions.sharp, "0.35.5");
const encoded = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#123456" } }).png().toBuffer();
const metadata = await sharp(encoded).metadata();
assert.equal(metadata.width, 32);
assert.equal(metadata.height, 24);
assert.equal(metadata.format, "png");
const resized = await sharp(encoded).resize(16, 12).raw().toBuffer({ resolveWithObject: true });
assert.equal(resized.info.width, 16);
assert.equal(resized.info.height, 12);
assert.equal(resized.info.channels, 3);
assert.equal(resized.data.length, 16 * 12 * 3);
for (let offset = 0; offset < resized.data.length; offset += 3) {
  assert.deepEqual([...resized.data.subarray(offset, offset + 3)], [0x12, 0x34, 0x56]);
}
console.log("PASS sharp: direct declaration and active workspace resolution are 0.35.5; PNG encode/decode, resize and RGB pixel preservation passed");
