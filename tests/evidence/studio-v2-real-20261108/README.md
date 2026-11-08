# Studio V2 — real Remotion QA evidence (NON-PRODUCTION)

These exact MP4 and PNG bytes were recovered from GitHub Actions **run 42465769901**, job **128684812321**, at source commit `4136f35a265875c2cbc21d9ac1982e1cb6e03811`.

- `silent.mp4`: rendered by actual Remotion `studio-v2-scene`, no audio.
- `narrated.mp4`: same Remotion composition with a 623Hz **technical sine wave** in AAC. **NOT** human narration, Quran recitation, or approval evidence.
- `silent.png` and `narrated.png`: FFmpeg-extracted frame near 1.00s, including Arabic diacritics.
- `silent-early.png` and `narrated-early.png`: FFmpeg-extracted frame near 0.10s for deterministic motion comparison.
- `report.json`: exact media SHA-256, streams, timing and system-available RAM/available disk samples.

Full MP4 decode succeeded. Files are committed as isolated test evidence only, not to a channel episode or production media location. There was no owner playback/approval and no signed Backend manifest registration. The sample at 640x360 was clipped; native 1920x1080 extracted frames are legible, but continuous human AV inspection is still required.

Source CI: https://github.com/saladin76/balislam/actions/runs/42465769901
