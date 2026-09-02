# Image robustness

Public evidence version: `tancmark-public-rc1-image-smoke-v1`.

| Format | Test class | Exact parameter | Corpus | Read mode | Expected ID supplied | Registry guided | Signed-map guided | Result | Wrong ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| raw RGBA | informed carrier round trip | 320×320, four 32×32 anchors, alpha 64, no attack | synthetic public gradient | informed reference-patch read | yes | no | no | four payload bytes exact | keyed finder rejected |

The public smoke proves the frequency-domain carrier arithmetic. It does not claim JPEG, crop, rotation, screen-camera, or phone-camera robustness. Those modes require a frozen media matrix and must state whether geometry was reversed.
