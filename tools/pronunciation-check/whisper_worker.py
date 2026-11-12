"""فحص النطق (D119): تفريغ محلي بـ faster-whisper على جهاز المالك. لا يرفع الصوت لأي خدمة.

يشغّله الاستوديو وحده (src/voice/pronunciation/whisperTool.ts) بمفسّر البيئة المعزولة التي ثبّتها زر «ثبّت فحص النطق».

  whisper_worker.py --download <models_dir> <model> [<revision>]
      ينزّل النموذج المثبّت مرة واحدة (التثبيت وحده؛ لا صوت فيه).
  whisper_worker.py --transcribe <model_dir>
      يقرأ من stdin سطور JSON: {"id": "...", "wav": "<ملف 16k mono s16>"}
      ويكتب لكل سطر: {"id": "...", "text": "..."} أو {"id": "...", "error": "..."}
      ثم {"done": true}. التفريغ بلا شبكة (HF_HUB_OFFLINE)، والصوت لا يغادر الجهاز.
"""
import json
import os
import sys


def download(models_dir, model, revision):
    # The same files faster-whisper's own download_model fetches, with the revision pinned when one is given.
    from huggingface_hub import snapshot_download

    out = os.path.join(models_dir, model)
    os.makedirs(out, exist_ok=True)
    path = snapshot_download(
        "Systran/faster-whisper-" + model,
        local_dir=out,
        revision=revision or None,
        allow_patterns=["config.json", "preprocessor_config.json", "model.bin", "tokenizer.json", "vocabulary.*"],
    )
    print(json.dumps({"model": path}), flush=True)


def read_wav(path):
    import wave

    with wave.open(path, "rb") as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise ValueError("wav must be 16-bit mono")
        frames = w.readframes(w.getnframes())
    try:
        import numpy as np  # always present with faster-whisper
    except ImportError:  # only the protocol test's stub model runs without it
        import array

        a = array.array("h")
        a.frombytes(frames)
        return [x / 32768.0 for x in a]
    return np.frombuffer(frames, dtype="<i2").astype("float32") / 32768.0


def transcribe(model_dir):
    os.environ["HF_HUB_OFFLINE"] = "1"
    from faster_whisper import WhisperModel

    threads = max(1, min(4, (os.cpu_count() or 2) // 2))
    model = WhisperModel(model_dir, device="cpu", compute_type="int8", cpu_threads=threads, local_files_only=True)
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        job = json.loads(line)
        try:
            audio = read_wav(job["wav"])
            # No initial_prompt: the sentence text is never given to the model, so it cannot "hear" what is written.
            segments, _info = model.transcribe(
                audio, language="ar", beam_size=5, temperature=0.0, vad_filter=False,
                condition_on_previous_text=False, without_timestamps=True,
            )
            text = " ".join(s.text.strip() for s in segments).strip()
            print(json.dumps({"id": job["id"], "text": text}, ensure_ascii=False), flush=True)
        except Exception as e:  # one bad file never stops the batch
            print(json.dumps({"id": job.get("id"), "error": str(e)[:300]}, ensure_ascii=False), flush=True)
    print(json.dumps({"done": True}), flush=True)


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "--download":
        download(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "")
    elif len(sys.argv) == 3 and sys.argv[1] == "--transcribe":
        transcribe(sys.argv[2])
    else:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
