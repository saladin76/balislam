"""يقص الأجزاء المحذوفة ويختصر الصمت الطويل. الاستعمال: assemble.py in.wav cuts.json out.wav"""
import sys, json, numpy as np, soundfile as sf
src, cutsf, out = sys.argv[1:4]
x, sr = sf.read(src, dtype="float32")
if x.ndim > 1: x = x.mean(1)
cuts = sorted(json.load(open(cutsf)))
# 1) احذف المقاطع مع تلاشٍ قصير عند كل وصلة
keep, t = [], 0.0
for a, b in cuts:
    keep.append((t, a)); t = b
keep.append((t, len(x) / sr))
fade = int(0.012 * sr)
parts = []
for a, b in keep:
    seg = x[int(a * sr):int(b * sr)].copy()
    if len(seg) < 2 * fade: continue
    ramp = np.linspace(0, 1, fade, dtype="float32")
    seg[:fade] *= ramp; seg[-fade:] *= ramp[::-1]
    parts.append(seg)
    parts.append(np.zeros(int(0.25 * sr), "float32"))
y = np.concatenate(parts)
# 2) اختصر أي صمت أطول من 0.9ث إلى 0.6ث (طاقة بنوافذ 20ms)
win = int(0.02 * sr)
n = len(y) // win
rms = np.sqrt((y[: n * win].reshape(n, win) ** 2).mean(1) + 1e-12)
db = 20 * np.log10(rms)
thr = np.percentile(db, 10) + 10
silent = db < thr
outp, i = [], 0
while i < n:
    j = i
    while j < n and silent[j] == silent[i]: j += 1
    seg = y[i * win:j * win]
    if silent[i] and (j - i) * 0.02 > 0.9:
        h = int(0.3 * sr)
        seg = np.concatenate([seg[:h], seg[-h:]])
    outp.append(seg); i = j
outp.append(y[n * win:])
z = np.concatenate(outp)
# اقطع البداية والنهاية الصامتتين مع ترك 0.3ث
nz = np.where(np.abs(z) > 10 ** ((thr + 6) / 20))[0]
z = z[max(0, nz[0] - int(0.3 * sr)): nz[-1] + int(0.5 * sr)]
sf.write(out, z, sr, subtype="PCM_24")
print(f"in {len(x)/sr:.1f}s -> out {len(z)/sr:.1f}s ; silence thr {thr:.1f} dB")
