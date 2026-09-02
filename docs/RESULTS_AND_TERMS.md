# TancMark Results and Terms

This document is the central vocabulary for public guides and evidence. A positive support signal is not automatically an identity or ownership result.

## The four operations

- **SEAL:** embed a deterministic identifier or support trace in a working copy.
- **RECOVER:** read the physical seal or identity signal from a received copy.
- **MATCH:** compare recovered evidence with an authorized record or bounded candidate set.
- **VERIFY:** check the unique registry record, tenant/account binding, and digital signature.

The safe chain is `SEAL -> RECOVER -> MATCH -> VERIFY`. Skipping `VERIFY` leaves physical evidence without full authority.

## Result classes

| Result | Meaning | Automatic ownership |
| --- | --- | --- |
| `EXACT` | The full physical identity and every required authority check matched. | Only within the verified module's scope. |
| `PARTIAL` | Some useful physical evidence survived, but the exact chain did not complete. | No. |
| `MANUAL_REVIEW` | Evidence is ambiguous, contradictory, or maps to more than one record. | No automatic result. |
| `NOT_FOUND` | The required physical evidence was not recovered. | No. |
| `FAIL-CLOSED` | A required safety condition was absent, so the operation stopped without guessing. | No. |

Product responses can use more specific verdict names, such as `VIDEO_LAYER_VAULT`, `AUDIO_LAYER_MATCH`, or `CANDIDATE_SUPPORT_ONLY`. Interpret them through the same authority chain and module scope.

## Exact authority chain

An authoritative module result requires all applicable conditions:

1. Full physical module identity recovered exactly.
2. One unique matching registry record.
3. Correct tenant and, where applicable, account binding.
4. Valid digital signature for that record.
5. No ambiguity, conflicting record, or fail-closed policy violation.

For video, Channel A is decisive. Channel B is corroboration. Channel B, the 32-bit L3 locator, a signed timing map, DNA, ECC, or similarity cannot open ownership alone. A short locator searches a bucket; it is not an encryption key and can repeat for different records.

## Scope of a result

- Text exact evidence applies to the authorized text record.
- Image exact evidence applies to the image layer tested by that reader.
- Audio exact evidence applies to audio. It does not claim video-image ownership.
- Video exact evidence applies to the physical video layer and its verified registry chain.
- Same-record exact audio and video can support a multi-channel result.
- Different exact audio and video records produce mixed-media provenance and manual review.
- Live final exact verification applies to the stopped protected recording and server-owned session binding.

## Blind reading by module

“Blind” means the original unsealed file is not required. It does not promise that the reader receives no identity, key, candidate, or addressing input.

| Module/read path | Original file supplied? | Expected identity or candidates supplied? | Length/shape known? | Position/map supplied? | Reference summary supplied? | Publicly supported description |
| --- | --- | --- | --- | --- | --- | --- |
| Text canary round trip | No | Document identity/key supplied for targeted verification | Canary format known | No original-position map | No | Keyed targeted blind read |
| Text zero-width fingerprint | No | Candidate client set supplied | Core bit length/channels known | No | No | Candidate-set blind attribution |
| Public image arithmetic smoke | A reference patch is used by the informed reader | Expected payload supplied | Anchor and payload shape known | Anchor layout/reference patches supplied | Yes, through informed reference data | Informed, not fully blind |
| Other image research readers | No original in blind modes; some modes are informed | Expected payload/key can be supplied | Carrier layout known | Geometry or signed addressing can be supplied | Depends on declared mode | Must be labelled blind, informed, or geometry-guided per result |
| Audio decision path | No | Expected 32-bit payload supplied | Payload length known | No original file; implementation can use its defined carrier schedule | No | Targeted expected-payload read |
| Video Primary | No | Server-owned full expected ID supplied | Channel/payload design known | Signed map can select the fast path; fallback physically searches | Registry/signature record used after recovery, not original media | Map-guided or VFR-safe targeted exact read |
| Live periodic/final read | No | Server-owned session ID binding/full ID supplied | Channel design known | Signed rolling map supplied for addressing | Registry, tenant/account, and signature supplied for verification | Server-internal targeted exact read |

The public image smoke does not justify a general “fully blind image reader” claim. Every published media result must state its actual read mode.

## Locator, candidate, and collision

A 32-bit locator is a short index. It narrows a large registry to a candidate bucket. Because only about 4.29 billion values exist, two independent records can have the same locator. Collision does not mean encryption failed; it means the short index is not unique enough for identity.

Safe behavior:

- No bucket match: continue searching or return `NOT_FOUND`.
- One candidate: perform the full strong physical and registry/signature verification.
- Several candidates: return `MANUAL_REVIEW`; select none automatically.
- Locator only, without full evidence: `CANDIDATE_SUPPORT_ONLY`.

## Maps and receipts

A signed exact/timing map is an addressing and integrity tool. It can make the reader faster and show where the server placed a signal. It is not identity authority. If crop, trim, frame loss, or retiming invalidates the exact map, the product can use its physical fallback. A map mismatch alone does not erase a real exact physical match, and a map alone never creates one.

Transport receipts prove transport/storage facts within their stated scope. They do not prove a physical watermark or ownership.

## C2PA terms

C2PA is provenance support. Its public status values include:

- `NO_C2PA`: no embedded C2PA information was found.
- `VALID_BUT_UNTRUSTED`: the manifest can be cryptographically valid, but public certificate trust was not established.
- `VALID_AND_TRUSTED`: both cryptographic validation and the configured trust decision passed.
- `VALID_AND_TRUSTED_TEST_CONTEXT`: trust exists only inside the explicit local test context.
- `INVALID_SIGNATURE`: signature validation failed.
- `ASSET_TAMPERED`: the asset no longer matches its manifest binding.
- `MALFORMED_MANIFEST`: the manifest could not be safely parsed/validated.
- `UNSUPPORTED_FORMAT`: the product policy rejects the format.
- `REMOTE_MANIFEST_BLOCKED`: remote retrieval was refused.
- `TRUST_STATUS_NOT_MEASURED`: the required trust decision was not measured.

None of these states opens TancMark VAULT or proves legal ownership.

## DNA, Chief Brain, and Discovery terms

- **DNA:** structured advisory information about modules, evidence, and compatibility. It does not override the exact module decision.
- **Chief Brain:** review/proposal coordination. `autoApply=false`; owner approval and exact hashes are required for controlled changes.
- **Discovery:** external search or detection candidates. A discovered item still needs authorized physical exact evidence and registry/signature verification.
- **Support evidence:** information useful to an investigation but insufficient for ownership.

## Evidence record checklist

For each result, record:

- module and implementation/version;
- source and received-copy checksums, kept privately when sensitive;
- transformation/test cell;
- read mode;
- whether original, expected ID, candidate set, layout/map, or reference was supplied;
- physical result and recovered bit/ID scope;
- registry, tenant/account, signature, and uniqueness results;
- final result class and module scope;
- wrong-ID, no-ID, wrong-tenant, and unsealed negative outcomes;
- `NOT_MEASURED` items and known limits.

Do not change a measured label after seeing the result. Do not report a partial channel as exact, a simulation as a real phone capture, or a local test certificate as public trust.
