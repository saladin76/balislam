# تجهيز تسجيلات الصوت (لاستنساخ الصوت في ElevenLabs)

أدوات صغيرة استُخدمت لتنظيف ساعتين من تسجيلات صاحب القناة قبل رفعها لـ Professional Voice Clone.
تُشغَّل يدويًا على جهازك (ليست جزءًا من الاستوديو). المتطلبات: `ffmpeg` و`pip install faster-whisper soundfile numpy librosa`.

## الخطوات لكل جلسة تسجيل

```bash
# 1) تحويل: نسخة 48k للعمل ونسخة 16k للنسخ الصوتي
ffmpeg -i session.m4a -ar 48000 -ac 1 -c:a pcm_s24le a48.wav
ffmpeg -i session.m4a -ar 16000 -ac 1 a16.wav

# 2) نسخ بتوقيت الكلمات، ثم كشف التكرار
python3 -I transcribe.py <whisper-model> a16.wav tr.json
python3 -I reps.py tr.json
python3 -I win.py <whisper-model> a16.wav 120:135        # تدقيق موضع مشكوك فيه

# 3) اكتب المقاطع المحذوفة في cuts.json: [[بداية, نهاية], …] بالثواني
#    القاعدة: تُحذف المحاولات المقطوعة والمكررة ويُبقى آخر أداء كامل.
python3 -I assemble.py a48.wav cuts.json cut.wav           # قص + اختصار الصمت الطويل إلى 0.6ث

# 4) تنظيف ومعايرة الصوت (−20 LUFS، قمة −3 dB)
ffmpeg -i cut.wav -af "highpass=f=70,afftdn=nr=10:nf=-50,loudnorm=I=-20:TP=-3:LRA=11" -ar 48000 master.wav

# 5) دمج الجلسات وتصدير MP3 بجودة 192k (ملفات ~30 دقيقة)
python3 -I merge.py all.wav s1/master.wav s2/master.wav …
ffmpeg -i part1.wav -b:a 192k part1.mp3
```

## قواعد

- **لا آيات في تسجيلات التدريب:** الصوت المستنسخ لا يتلو القرآن، فتُحذف كل تلاوة أو اقتباس آية قبل الرفع.
- سجّل بصيغة بلا ضغط (Voice Memos ← Lossless)؛ تسجيلات AAC المضغوطة أضعف وأخفض صوتًا.
- `voicestats.py` يقارن صوت ElevenLabs بتسجيلك (الطبقة والمدى) بعد التدريب، للتأكد من التطابق.
