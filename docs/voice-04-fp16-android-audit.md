# VOICE-04 – FP16 Android technical audit (2026-11-16)

## Scope
Draft PR #266 only. No production rollout; CORE unchanged.

## Source and provenance
- Experimental source: Kyumdroid/supertonic-3-quant, revision d9bfd0a9384b42a76f9256eafdd3d8a5cc4706ba.
- Upstream: Supertone/supertonic-3. Model card states OpenRAIL-M restrictions; review the complete license and attribution before release.
- The third-party card describes FP16 conversion with keep_io_types=True, and Czech among 31 languages.
- Model card reports ~191 MB for the four FP16 components; vector_estimator.onnx ~129 MB.
- These figures are upstream claims, not measurements on our target Android phone.

## Code path reviewed
- neural-match-voice.js selects FP16 only if the page URL has ?voiceFp16=1.
- Worker receives ?model=fp16 and loads four models plus configuration/tokenizer from the pinned fp16/onnx directory.
- Voice style M2 remains from the original upstream source.
- Default path without opt-in still uses original FP32 assets.
- Android device speech remains the fallback after errors or the 180-second timeout.

## What the existing CI verifies
- Frontend smoke and browser smoke passed on prior commit 521f4c4.
- No verified FP16 synthesis, memory measurement, network throughput, WASM compatibility or Android audio quality test.
- CI success alone does not establish browser WebAssembly FP16 operator compatibility.

## Release blockers
1. Verify the pinned Hugging Face revision resolves all six required files (4 ONNX, tts.json, unicode_indexer.json) and their CORS response headers from the actual browser.
2. Verify license obligations, attribution and model restrictions for a public application.
3. Test on Android Chrome with the experimental URL, log stage timing and memory/timeout behavior.
4. Confirm intelligible Czech speech and professional M2 commentary; compare to original quality.
5. Only after those tests, decide whether to offer an explicit experimental toggle or pursue server-side synthesis.

## Important caveat
The 180-second Vector Estimator timeout could reflect network download, WASM initialization, or device memory. Smaller FP16 downloads do not by themselves prove a fix.
