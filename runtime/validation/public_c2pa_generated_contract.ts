// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import {
  SignAndEmbedC2pa201Response,
  SignAndEmbedC2paBody,
} from "../../lib/api-zod/src/generated/api.ts";

const common = {
  assetName: "input.png",
  outputName: "output.png",
  registryRecordId: "record:public:1",
  recordVersion: "1",
  algorithmVersion: "tancmark-1",
  createdAt: "2026-08-28T00:00:00.000Z",
};

const digitalSourceType =
  "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation";

assert.equal(
  SignAndEmbedC2paBody.safeParse({
    ...common,
    intent: "CREATE",
    digitalSourceType,
  }).success,
  true,
  "a valid CREATE request must pass",
);
assert.equal(
  SignAndEmbedC2paBody.safeParse({ ...common, intent: "CREATE" }).success,
  false,
  "CREATE without digitalSourceType must fail",
);
assert.equal(
  SignAndEmbedC2paBody.safeParse({ ...common, intent: "EDIT" }).success,
  true,
  "EDIT without digitalSourceType must pass",
);
assert.equal(
  SignAndEmbedC2paBody.safeParse({
    ...common,
    intent: "EDIT",
    digitalSourceType,
  }).success,
  false,
  "EDIT with digitalSourceType must fail",
);
assert.equal(
  SignAndEmbedC2paBody.safeParse({ ...common, intent: "UPDATE" }).success,
  true,
  "UPDATE without digitalSourceType must pass",
);
assert.equal(
  SignAndEmbedC2paBody.safeParse({
    ...common,
    intent: "CREATE",
    digitalSourceType,
    createdAt: "not-a-date",
  }).success,
  false,
  "invalid createdAt must fail",
);

const c2pa = {
  status: "VALID_BUT_UNTRUSTED",
  message: "Manifest valid in local test context.",
  manifestPresent: true,
  manifestEmbedded: true,
  cryptographicallyValid: true,
  assetIntegrityValid: true,
  trustStatus: "UNTRUSTED_TEST_CERTIFICATE",
  claimGenerator: ["TancMark"],
  claimVersion: 2,
  assertions: ["c2pa.actions"],
  ingredients: { count: 0 },
  actions: ["c2pa.created"],
  signingInformation: { signatureVerified: true, trustVerified: false },
  assetBinding: "VALID",
  manifestStore: "PRESENT_REDACTED",
  tancmarkAssertion: null,
  provenanceAvailable: true,
  safety: {
    supportOnly: true,
    c2paCanOpenVault: false,
    ownership: false,
    confirmed: false,
    final: false,
    rawExpectedIdDisclosed: false,
    privateRegistryDisclosed: false,
    privateMapDisclosed: false,
    filePathDisclosed: false,
    certificateContentsDisclosed: false,
    privateKeyDisclosed: false,
  },
} as const;

const response = {
  ok: true,
  signedAndEmbedded: true,
  c2pa,
  safety: {
    c2paCanOpenVault: false,
    ownership: false,
    privateKeyDisclosed: false,
    outputPathDisclosed: false,
    externalNetworkCalls: 0,
  },
} as const;

assert.equal(
  SignAndEmbedC2pa201Response.safeParse(response).success,
  true,
  "the safe sign/embed response must pass",
);
assert.equal(
  SignAndEmbedC2pa201Response.safeParse({
    ...response,
    c2pa: { ...c2pa, safety: { ...c2pa.safety, ownership: true } },
  }).success,
  false,
  "a forged C2PA ownership result must fail",
);
assert.equal(
  SignAndEmbedC2pa201Response.safeParse({
    ...response,
    safety: { ...response.safety, c2paCanOpenVault: true },
  }).success,
  false,
  "a forged VAULT result must fail",
);

console.log(JSON.stringify({
  contract: "public_c2pa_generated_contract",
  status: "passed",
  cases: 9,
  validIsoDateAccepted: true,
  intentDiscriminatorEnforced: true,
  forgedOwnershipRejected: true,
  forgedVaultRejected: true,
}));
