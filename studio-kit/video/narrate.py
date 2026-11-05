"""Local CPU Kokoro preset synthesis. No hosted services, credentials or voice cloning."""
import json
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline, KModel
from huggingface_hub import hf_hub_download
root=Path(__file__).resolve().parent
out=root/'artifacts'
markers=json.loads((out/'markers.json').read_text())
cues=[
 ('intro',0.35,'Meet Lantern Crate, a fictional shop. Let us place a sample order.'),
 ('shop',0.6,'The shop keeps its order form on one page. This earlier sample collects no payment.'),
 ('name',0.1,'Rowan enters an invented name, then adds a sample email address.'),
 ('quantity',0.2,'Choose two tea tins, then place the sample order.'),
 ('success',0.2,'The confirmation shows the order number and total. The order is stored in memory for this session.'),
 ('outro',0.1,'A simple journey, with a visible result. Fictional data throughout.'),
]
torch.set_num_threads(4)
revision='f3ff3571791e39611d31c381e3a41a3af07b4987'
def model_file(name):
 return hf_hub_download('hexgrad/Kokoro-82M',name,revision=revision)
model=KModel(repo_id='hexgrad/Kokoro-82M',config=model_file('config.json'),model=model_file('kokoro-v1_0.pth'))
pipeline=KPipeline(lang_code='a',repo_id='hexgrad/Kokoro-82M',model=model,device='cpu')
voice=model_file('voices/af_heart.pt')
master=np.zeros(36*24000,dtype=np.float32)
records=[]
for i,(anchor,offset,text) in enumerate(cues):
 start=markers[anchor]+offset
 end=markers[cues[i+1][0]]+cues[i+1][1]-.2 if i+1<len(cues) else 35.9
 pieces=[a.numpy() if hasattr(a,'numpy') else a for _,_,a in pipeline(text,voice=voice,speed=1.10)]
 audio=np.concatenate(pieces)
 duration=len(audio)/24000
 if start+duration>end: raise RuntimeError(f'Cue {anchor} overflows: {duration:.2f}s in {end-start:.2f}s window; shorten copy')
 pos=round(start*24000); master[pos:pos+len(audio)]=audio
 records.append(dict(anchor=anchor,start=round(start,3),duration=round(duration,3),text=text))
 sf.write(out/f'cue-{i}.wav',audio,24000)
 print(f'{anchor}: start={start:.2f}s speech={duration:.2f}s window={end-start:.2f}s')
sf.write(out/'narration-raw.wav',master,24000,subtype='PCM_16')
(out/'cues.json').write_text(json.dumps(records,indent=2))
(root/'narration.md').write_text('# Lantern Crate — fictional sample\n\n| Time | Narration |\n| --- | --- |\n'+''.join(f'| {c["start"]:.2f}s | {c["text"]} |\n' for c in records))
print('Voice: Kokoro 0.9.4 / af_heart / CPU; no time stretching')
