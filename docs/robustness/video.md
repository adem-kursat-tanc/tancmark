# Video robustness

Evidence version: `tancmark-video-advanced-recovery-integration-20260827`.

| Format | Test class | Exact parameter | Corpus | Read mode | Expected ID supplied | Registry guided | Signed-map guided | Result | Wrong ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H.264 MP4 | baseline | normal delivery encode | real local, redacted | server-owned targeted exact | yes | yes | yes | exact + registry + signature | 0 |
| H.264 MP4 | rotation recovery | 90° clockwise; 270° inverse normalization | real local, redacted | geometry-reversed targeted exact | yes | yes | yes | exact after normalization | 0 |
| H.264 MP4 | center crop recovery | historical 1.25 center inverse scale | real local, redacted | geometry-reversed targeted exact | yes | yes | yes | exact after normalization | 0 |
| H.264 MP4 | resize recovery | 1280×730; signed source-raster receipt | real local, redacted | receipt-guided targeted exact | yes | yes | yes | exact after normalization | 0 |
| H.264 MP4 | screen-record simulation | preserved signed source-raster receipt | simulation, not a phone capture | receipt-guided targeted exact | yes | yes | yes | exact | 0 |
| H.264 MP4 | extreme front trim | almost all beginning removed | real/local transform, redacted | VFR-safe recovery | yes | yes | fallback | fail closed; no ownership | 0 |
| H.264 MP4 | phone-camera local simulation | frozen local simulation | simulation, not a real phone | recovery search | yes | yes | fallback | fail closed; no ownership | 0 |

The frozen physical matrix was 14/16. The two failed cells above are retained as limits. Channel B and the 32-bit locator never opened ownership. A separate historical real-phone corpus recovered its full presentation identity in 38/43 frames, but registry/signature authority was not measured there; it is not reported as `VIDEO_LAYER_VAULT`.
