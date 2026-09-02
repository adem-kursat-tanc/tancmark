import assert from "node:assert/strict";
import { Aegis } from "../../lib/aegis-core/src/index.ts";
import { decodeTripleShieldInformed, deriveR1FinderSigns, expectedTripleShieldAnchors, stampTripleShield } from "../../lib/aegis-core/src/layers/visual/tripleShield.ts";
import { buildAudioSupportAdvisory } from "../../artifacts/api-server/src/video/audioSupportAdvisory.ts";
import { decideL1L3Evidence } from "../../artifacts/api-server/src/video/aegisCore.ts";

const aegis = new Aegis({ secret: "public-smoke-secret-v1" });
const text = "TancMark public deterministic watermark smoke sentence with enough stable words for a copied-text round trip.";
const fingerprinted = aegis.fingerprint(text, "public-client-a");
assert.equal(aegis.identify(fingerprinted, ["public-client-b", "public-client-a"]).userId, "public-client-a");
const canary = aegis.injectCanary(text, "public-document-a", 0.2);
assert.equal(aegis.verifyCanary(canary.text, "public-document-a").found, true);
assert.equal(aegis.verifyCanary(canary.text, "public-document-wrong").found, false);

const width = 320;
const height = 320;
const clean = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
  const at = (y * width + x) * 4;
  const value = 96 + ((x * 7 + y * 11) % 96);
  clean[at] = value; clean[at + 1] = value; clean[at + 2] = value; clean[at + 3] = 255;
}
const stamped = clean.slice();
const payload = Uint8Array.of(0x12, 0x34, 0x56, 0x78);
const secret = new TextEncoder().encode("public-image-secret-v1");
const identity = "0123456789abcdef0123456789abcdef";
const anchors = expectedTripleShieldAnchors(width, height);
const recovered: number[] = [];
const wrongNcc: number[] = [];
for (let index = 0; index < anchors.length; index += 1) {
  const anchor = anchors[index]!;
  const signs = deriveR1FinderSigns(secret, anchor.id, identity);
  stampTripleShield(stamped, width, height, anchor.x, anchor.y, signs, payload[index]!, 64);
  const ref = new Float64Array(1024);
  for (let py = 0; py < 32; py += 1) for (let px = 0; px < 32; px += 1) {
    const at = ((anchor.y + py) * width + anchor.x + px) * 4;
    ref[py * 32 + px] = clean[at]!;
  }
  recovered.push(decodeTripleShieldInformed(stamped, width, height, anchor.x, anchor.y, ref, signs).dataBits8);
  const wrong = deriveR1FinderSigns(new TextEncoder().encode("wrong-image-secret-v1"), anchor.id, identity);
  wrongNcc.push(decodeTripleShieldInformed(stamped, width, height, anchor.x, anchor.y, ref, wrong).r1Ncc);
}
assert.deepEqual(recovered, [...payload]);
assert(wrongNcc.some((value) => value < 1));

assert.equal(buildAudioSupportAdvisory(32).candidateSupportOnly, false);
assert.equal(buildAudioSupportAdvisory(31).candidateSupportOnly, true);
assert.equal(decideL1L3Evidence(false, true).decision, "candidate_support");
assert.equal(decideL1L3Evidence(false, true).authority.canOpenVault, false);
assert.equal(decideL1L3Evidence(true, true).verifiedMatch, true);

process.stdout.write(`${JSON.stringify({ contract: "public_core_smoke", status: "passed", text: { exactCandidate: true, wrongIdRejected: true }, image: { payloadBytesExact: "4/4", wrongKeyFinderPerfectCount: wrongNcc.filter((value) => value === 1).length, readMode: "INFORMED_REFERENCE_PATCH" }, audio: { exact32Decision: true, partial31CandidateOnly: true, physicalMediaIntegration: "NOT_RUN_BY_THIS_SMOKE" }, video: { shortLocatorAloneOwnership: false, strongAndLocatorPhysicalMatch: true, physicalMediaIntegration: "NOT_RUN_BY_THIS_SMOKE" }, externalNetworkCalls: 0 }, null, 2)}\n`);
