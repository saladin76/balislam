"""نسخ صوتي بتوقيت الكلمات (faster-whisper). الاستعمال: transcribe.py model_dir audio16k.wav tr.json"""
import sys, json, time
from faster_whisper import WhisperModel
model_dir, audio, out = sys.argv[1:4]
m = WhisperModel(model_dir, device="cpu", compute_type="int8", cpu_threads=2)
t = time.time()
import soundfile as sf
aud, _sr = sf.read(audio, dtype="float32")
segs, info = m.transcribe(aud, language="ar", word_timestamps=True, vad_filter=False, beam_size=3, condition_on_previous_text=False)
res = []
for s in segs:
    res.append({"start": s.start, "end": s.end, "text": s.text.strip(), "words": [{"s": w.start, "e": w.end, "w": w.word, "p": w.probability} for w in (s.words or [])]})
    print(f"{s.start:7.1f} {s.end:7.1f} {s.text.strip()}", flush=True)
json.dump(res, open(out, "w"), ensure_ascii=False)
print("took", time.time() - t)
