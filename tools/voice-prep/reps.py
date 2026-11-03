"""يكشف الكلمات المكررة فورًا (إعادة جملة أو تلعثم) من نسخ Whisper. الاستعمال: reps.py tr.json"""
import json,sys
T=json.load(open(sys.argv[1]))
W=[(w['w'].strip(' .،,؟?'),w['s'],w['e']) for s in T for w in s['words']]
N=len(W); i=0; out=[]
while i<N:
  best=None
  for gap in range(0,5):
    for n in range(12,0,-1):
      j=i+n+gap
      if j+n<=N and [x[0] for x in W[i:i+n]]==[x[0] for x in W[j:j+n]] and (n>=2 or gap==0):
        if not best or n>best[0]: best=(n,j)
        break
  if best:
    n,j=best
    print(f"{W[i][1]:7.2f} -> {W[j][1]:7.2f} | first: {' '.join(x[0] for x in W[i:j])} | next: {' '.join(x[0] for x in W[j:j+n+2])}")
    i=j
  else: i+=1
