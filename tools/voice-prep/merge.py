"""يدمج تسجيلات نظيفة متتالية (بفاصل 0.7ث) في ملف واحد. الاستعمال: merge.py out.wav in1.wav in2.wav …"""
import sys, numpy as np, soundfile as sf
files=sys.argv[2:]; out=sys.argv[1]
sr=48000; parts=[]
for f in files:
    x,s=sf.read(f,dtype='float32'); assert s==sr, (f,s)
    parts += [x, np.zeros(int(0.7*sr),'float32')]
y=np.concatenate(parts)
# split into 4 near-equal parts at the quietest 0.3s window near each target
n=4; L=len(y); cuts=[0]
w=int(0.3*sr)
for k in range(1,n):
    t=int(L*k/n); a=t-int(60*sr); b=t+int(60*sr)
    seg=y[a:b]; m=(len(seg)//w)
    e=(seg[:m*w].reshape(m,w)**2).mean(1)
    i=int(np.argmin(e)); cuts.append(a+i*w+w//2)
cuts.append(L)
for k in range(n):
    sf.write(f"{out}_{k+1}.wav", y[cuts[k]:cuts[k+1]], sr, subtype='PCM_24')
    print(k+1, (cuts[k+1]-cuts[k])/sr/60)
