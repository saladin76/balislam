"""يعيد نسخ نوافذ زمنية محددة بدقة أعلى. الاستعمال: win.py model_dir file.wav 12.5:20 40:47 …"""
import sys,json
from faster_whisper import WhisperModel
import soundfile as sf
m=WhisperModel(sys.argv[1],device="cpu",compute_type="int8",cpu_threads=2)
x,sr=sf.read(sys.argv[2],dtype="float32")
for spec in sys.argv[3:]:
  a,b=map(float,spec.split(':'))
  seg=x[int(a*sr):int(b*sr)]
  S,_=m.transcribe(seg,language="ar",word_timestamps=True,beam_size=5,condition_on_previous_text=False,vad_filter=False)
  print('==',spec)
  for s in S: print(' | '.join(f"{w.word.strip()}@{a+w.start:.2f}" for w in s.words))
