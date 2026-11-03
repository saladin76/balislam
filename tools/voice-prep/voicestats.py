"""مقارنة نبرة الصوت: متوسط طبقة الصوت (F0) ومداها ومركز الطيف. الاستعمال: voicestats.py a.mp3 b.wav …"""
import sys, numpy as np, librosa
for f in sys.argv[1:]:
    y, sr = librosa.load(f, sr=16000, mono=True, duration=240)
    f0, vf, _ = librosa.pyin(y, fmin=60, fmax=350, sr=sr, frame_length=1024)
    f0 = f0[vf]
    S = np.abs(librosa.stft(y, n_fft=1024))
    cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    rms = librosa.feature.rms(S=S, frame_length=1024)[0]
    voiced = rms > np.percentile(rms, 40)
    print(f"{f.split('/')[-2]:8s} F0 median {np.median(f0):6.1f} Hz  p10-p90 {np.percentile(f0,10):5.1f}-{np.percentile(f0,90):5.1f}  range(st) {12*np.log2(np.percentile(f0,90)/np.percentile(f0,10)):4.1f}  centroid {np.median(cent[voiced]):6.0f}")
