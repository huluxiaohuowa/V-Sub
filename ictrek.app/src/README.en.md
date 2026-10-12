# V-Sub __APP_VERSION__

Subtitle transcription, translation, proofreading, dubbing, composition and media export in a VOS browser app, preserving SmartSub's workflows and local engine management.

VOS OIDC Fastpath verifies the account. V-Router automatically supplies available ASR/TTS models, including V-Voice and configured standard cloud audio endpoints. V-Voice voices are fetched per model; standard cloud endpoints without a voice catalog use the standard OpenAI voice list.

Upload or drop files in the browser. Files, settings, tasks and local models are isolated by verified VOS account and OS identity. Exports are downloaded through the browser. Ready local ASR/TTS models register privately with V-Router, refreshing every 30 seconds with a 90-second lease. ZipVoice registers privately once its model and user reference voices are ready.

CPU profiles run native local CPU engines. AMD CUDA, ARM CUDA, Jetson/L4T and Thor profiles reuse V-Voice’s specialized sherpa-onnx GPU wheels and matching CUDA/ONNX Runtime libraries. L4T Paraformer uses the same CPU compatibility fallback as V-Voice. The ARM whisper.cpp addon is built from source. Engine availability reflects the actual installed runtime.

Choose Follow VOS, Simplified Chinese, Traditional Chinese or English without reloading or losing form contents. Manual language preferences belong only to V-Sub.
