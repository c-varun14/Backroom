"""Check the scripted public media, never credential-bearing runtime files."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'workspaces/bakery-live/video/artifacts';file=out/'bakery-demo.mp4'
m=json.loads((out/'manifest.json').read_text());digest=hashlib.sha256(file.read_bytes()).hexdigest();assert digest==m['sha256']
r=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels','-of','json',str(file)],capture_output=True,text=True,check=True)
p=json.loads(r.stdout);v=next(x for x in p['streams'] if x['codec_type']=='video');a=next(x for x in p['streams'] if x['codec_type']=='audio')
assert v['width']==1920 and v['height']==1080 and v['codec_name']=='h264' and a['codec_name']=='aac' and a['sample_rate']=='48000' and 30<=float(p['format']['duration'])<=45
r=subprocess.run(['ffmpeg','-hide_banner','-i',str(file),'-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
l=json.loads(re.search(r'\{\s*"input_i"[\s\S]*?\}',r.stderr)[0]);assert abs(float(l['input_i'])+16)<=.5 and float(l['input_tp'])<=-1.5
print(f"PASS video: {p['format']['duration']}s, {v['width']}x{v['height']}, {v['codec_name']}/{a['codec_name']}, {a['sample_rate']}Hz, {l['input_i']} LUFS, {l['input_tp']} dBTP")
print('SHA-256:',digest)
print('Human listening and ASR: not performed. Capture uses isolated fictional SQLite and cached Kokoro af_heart; no hosted narration.')
