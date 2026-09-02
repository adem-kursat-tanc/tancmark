# Live robustness

The provider-independent Live core was validated locally with real H.264/AAC media and a real 7:44 VFR video. The original files were not modified; names, paths and hashes are withheld.

| Gate | Result |
| --- | --- |
| CPU profile | 4-second CMAF fragments, 20 fps, no GPU/AI |
| 7:44 paced 1x | Passed; 116 fragments, maximum backlog 0 |
| Watermark p95 | 3.540 s for a 4.000 s fragment p95 |
| Frame integrity | 9,276 in / 9,276 out; loss 0; cumulative drift 0 |
| Audio integrity | 19,977 in / 19,977 out; packet payload exact |
| Final decision | `VIDEO_LAYER_VAULT` via Channel A exact + registry + tenant/account + signature |
| Live samples | 16/38 strong exact; non-exact samples never opened ownership |
| Unsealed real negatives | 3/3 `NOT_FOUND`; ownership 0 |
| Concurrent tenants | 2/2 correct exact decisions; cross-tenant leak 0 |
| Crash/recovery | 8/8 local fault cells passed |

Read mode: periodic and final reads use the server-owned exact ID and signed rolling placement map. The original source file is not supplied to the reader. The signed map accelerates addressing but cannot grant ownership by itself.

Limits:

- The verified CPU-safe profile publishes new authoritative fragments on a 4-second media cadence. One- and two-second profiles did not reliably meet the sustained p95/backlog gate on the measured machine.
- Final exact verification of the 7:44 recording took about 68.5 seconds.
- External provider delivery remains user-configured and was not tested here.
