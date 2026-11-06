"""Independent structure, script fidelity, sound, and artifact checks."""
import json
from pathlib import Path
import re
import subprocess
import wave
import array
import math

root=Path(__file__).resolve().parent
repo=root.parents[2]
scenes=json.loads((root/"storyboard.json").read_text())
cues=json.loads((root/"cues.json").read_text())
manifest=json.loads((root/"manifest.json").read_text())
assert len(scenes)==19 and scenes[0]["start"]==0 and scenes[-1]["end"]==178
assert all(a["end"]==b["start"] for a,b in zip(scenes,scenes[1:]))
assert scenes[0]["end"]==10 and next(s for s in scenes if s["id"]=="payoff")["start"]==20
assert all(s["replace"] for s in scenes)
rows=[line.split("|")[1:-1] for line in (repo/"docs/submission/video-script.md").read_text().splitlines() if re.match(r"\| \d:",line)]
assert " ".join(c["text"] for c in cues)==" ".join(row[2].strip() for row in rows[1:])
starts={s["id"]:s["start"] for s in scenes}
assert all(abs(c["start"]-(starts[c["anchor"]]+c["offset"]))<.001 for c in cues)
assert all(a["start"]+a["duration"]+.1<=b["start"] for a,b in zip(cues,cues[1:]))
assert cues[0]["start"]>=10 and cues[-1]["start"]+cues[-1]["duration"]<178
with wave.open(str(root/"artifacts/narration-raw.wav")) as wav:
    assert wav.getframerate()==24000 and wav.getnchannels()==1 and wav.getsampwidth()==2
    samples=array.array("h",wav.readframes(wav.getnframes()))
    assert max(abs(s) for s in samples[:10*24000])==0
    voiced=samples[10*24000:]
    rms=math.sqrt(sum(float(s)*s for s in voiced)/len(voiced))/32768
    assert rms>.01 and max(abs(s) for s in samples)<32767
assert len(manifest["outputs"])==2
for item in manifest["outputs"]:
    p=root/"artifacts"/item["path"]
    assert p.stat().st_size==item["bytes"] and item["duration"]<180
    assert item["fullDecode"] and not item["blackFrames"]
    ignored=subprocess.run(["git","check-ignore","-q",str(p)],cwd=repo)
    assert ignored.returncode==0
assert all((root/"artifacts"/f'final-{s["id"]}.png').exists() for s in scenes)
paths=[p for p in root.iterdir() if p.is_file()]+[repo/"reports/rough-video.md"]
for path in paths:
    result=subprocess.run(["git","diff","--no-index","--check","/dev/null",str(path)],cwd=repo,capture_output=True,text=True)
    # --no-index returns 1 for new-file differences, even when --check is clean.
    assert result.returncode in (0,1) and not result.stdout and not result.stderr, (path.name,result.stdout,result.stderr)
print("PASS timeline: 19 contiguous shots, 178s; opening reserved 0–10s; bakery payoff at 20s.")
print(f"PASS script: {len(cues)} anchored, non-overlapping cues; narration verbatim after the opening; every shot has a replacement instruction.")
print(f"PASS source audio: 10.000s digital silence reserved; remaining RMS {20*math.log10(rms):.2f} dBFS; no clipped PCM samples.")
print("PASS artifacts: both final media files match manifest sizes, remain git-ignored, and have complete decode/black-frame checks; 19 final chapter frames present.")
print(f"PASS whitespace: {len(paths)} section-B source/report files; git diff --no-index --check emitted no whitespace diagnostics.")
