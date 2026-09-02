# Audio robustness

Evidence version: `tancmark-audio-v01-decision-boundary-v1`.

| Format | Test class | Exact parameter | Corpus | Read mode | Expected ID supplied | Registry guided | Signed-map guided | Result | Wrong ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| decision telemetry | authority boundary | 32/32 bits | synthetic public telemetry | targeted expected payload | yes | no | no | exact audio candidate; registry still required | 31/32 remains candidate only |

The repository includes the standalone audio seal/read implementation, but this public snapshot does not publish a redacted codec-attack matrix with enough detail to make a robustness claim. Actual WAV/AAC/MP3 integration therefore remains a separately runnable FFmpeg test, not a CI success implied by this table.
