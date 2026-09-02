import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Aegis } from "../../lib/aegis-core/src/index.ts";
import { decodeTripleShieldInformed, deriveR1FinderSigns, expectedTripleShieldAnchors, stampTripleShield } from "../../lib/aegis-core/src/layers/visual/tripleShield.ts";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-public-text-image-"));
try {
  const textPath = path.join(temp, "sealed.txt");
  const aegis = new Aegis({ secret: "public-physical-text-secret-v1" });
  const sourceText = "TancMark deterministic physical text file round trip with enough stable words for the blind candidate reader.";
  fs.writeFileSync(textPath, aegis.fingerprint(sourceText, "public-text-owner-a"), "utf8");
  const recoveredText = aegis.identify(fs.readFileSync(textPath, "utf8"), ["public-text-owner-wrong", "public-text-owner-a"]);
  assert.equal(recoveredText.userId, "public-text-owner-a");
  assert.notEqual(aegis.identify(fs.readFileSync(textPath, "utf8"), ["public-text-owner-wrong"]).userId, "public-text-owner-wrong");

  const width = 320; const height = 320;
  const clean = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const at = (y * width + x) * 4; const value = 72 + ((x * 13 + y * 17) % 144);
    clean[at] = value; clean[at + 1] = value; clean[at + 2] = value; clean[at + 3] = 255;
  }
  const stamped = clean.slice();
  const payload = Uint8Array.of(0x21, 0x43, 0x65, 0x87);
  const secret = new TextEncoder().encode("public-physical-image-secret-v1");
  const wrongSecret = new TextEncoder().encode("public-physical-image-wrong-v1");
  const identity = "fedcba9876543210fedcba9876543210";
  const anchors = expectedTripleShieldAnchors(width, height);
  const references: Float64Array[] = [];
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!; const signs = deriveR1FinderSigns(secret, anchor.id, identity); const reference = new Float64Array(1024);
    for (let py = 0; py < 32; py += 1) for (let px = 0; px < 32; px += 1) reference[py * 32 + px] = clean[((anchor.y + py) * width + anchor.x + px) * 4]!;
    references.push(reference); stampTripleShield(stamped, width, height, anchor.x, anchor.y, signs, payload[index]!, 64);
  }
  const imagePath = path.join(temp, "sealed.ppm");
  const ppm = Buffer.alloc(15 + width * height * 3); ppm.write("P6\n320 320\n255\n", 0, "ascii");
  for (let pixel = 0; pixel < width * height; pixel += 1) { ppm[15 + pixel * 3] = stamped[pixel * 4]!; ppm[16 + pixel * 3] = stamped[pixel * 4 + 1]!; ppm[17 + pixel * 3] = stamped[pixel * 4 + 2]!; }
  fs.writeFileSync(imagePath, ppm);
  const disk = fs.readFileSync(imagePath); assert.equal(disk.subarray(0, 15).toString("ascii"), "P6\n320 320\n255\n");
  const diskRgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) { diskRgba[pixel * 4] = disk[15 + pixel * 3]!; diskRgba[pixel * 4 + 1] = disk[16 + pixel * 3]!; diskRgba[pixel * 4 + 2] = disk[17 + pixel * 3]!; diskRgba[pixel * 4 + 3] = 255; }
  const exactReads = anchors.map((anchor, index) => decodeTripleShieldInformed(diskRgba, width, height, anchor.x, anchor.y, references[index]!, deriveR1FinderSigns(secret, anchor.id, identity)));
  const wrongReads = anchors.map((anchor, index) => decodeTripleShieldInformed(diskRgba, width, height, anchor.x, anchor.y, references[index]!, deriveR1FinderSigns(wrongSecret, anchor.id, identity)));
  assert.deepEqual(exactReads.map((read) => read.dataBits8), [...payload]);
  const wrongKeyPerfectFinderCount = wrongReads.filter((read) => read.r1Ncc === 1).length;
  assert.equal(wrongKeyPerfectFinderCount, 0);
  process.stdout.write(`${JSON.stringify({ contract: "public_physical_text_image_contract", status: "passed", text: { fileRoundTrip: true, blindCandidateRead: true, wrongCandidateAccepted: false }, image: { format: "PPM_P6", physicalFileRoundTrip: true, payloadBytesExact: "4/4", locatorBytesMayMatchUnderWrongKey: true, wrongKeyPerfectFinderCount, wrongKeyStrongVerificationAccepted: false, wrongKeyVault: false, readMode: "INFORMED_REFERENCE_PATCH" }, privateMediaUsed: false, pathsDisclosed: false, externalNetworkCalls: 0 }, null, 2)}\n`);
} finally {
  const resolved = path.resolve(temp); const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  fs.rmSync(resolved, { recursive: true, force: true });
}
