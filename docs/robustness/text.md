# Text robustness

Public evidence version: `tancmark-public-rc1-text-smoke-v1`.

| Format | Test class | Exact parameter | Corpus | Read mode | Expected ID supplied | Registry guided | Signed-map guided | Result | Wrong ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UTF-8 text | deterministic round trip | canary density 0.20; unchanged copied text | synthetic public sentence | keyed targeted read; original not supplied | document ID supplied | no | no | exact canary found | not found |
| UTF-8 text | zero-width fingerprint | default core bit length; unchanged copied text | synthetic public sentence | candidate-set blind attribution | candidate set supplied | no | no | exact candidate selected | rejected |

These rows test deterministic sealing/reading and negative identity handling. They are not claims about paraphrase survival. No public paraphrase attack matrix is claimed in this release candidate.
