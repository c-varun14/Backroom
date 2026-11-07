"""Adapted from studio-kit/video/narrate.py; same pinned local CPU Kokoro path."""
import json
import os
import re
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline, KModel
from huggingface_hub import hf_hub_download

root = Path(__file__).resolve().parent
repo = root.parents[2]
out = root / "artifacts"
torch.set_num_threads(4)
revision = "f3ff3571791e39611d31c381e3a41a3af07b4987"
def model_file(name):
    return hf_hub_download("hexgrad/Kokoro-82M", name, revision=revision, local_files_only=True)

model = KModel(repo_id="hexgrad/Kokoro-82M", config=model_file("config.json"), model=model_file("kokoro-v1_0.pth"))
pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", model=model, device="cpu")
voice = model_file("voices/af_heart.pt")
master = np.zeros(178 * 24000, dtype=np.float32)
records = []
# Cue starts are anchored to the final storyboard, rather than front-loading each
# chapter's speech before the corresponding review/video/lesson card appears.
placements = [
    ("overview", .25, 20), ("overview", 8.75, 30),
    ("revision-native", .25, 39), ("revision-native", 8.05, 50),
    ("architecture-question", .25, 60), ("architecture-stale", .25, 70),
    ("handoff", .25, 80), ("review", .25, 90),
    ("release", .25, 106), ("product-proof", .10, 110),
    ("blocked-send", .25, 121), ("video", .25, 135),
    ("prices", .25, 145), ("privacy", .25, 155), ("backward-fix", .25, 165),
    ("receipt", .25, 178), ("outro", 1.025, 178),
]
scene_starts={s["id"]:s["start"] for s in json.loads((root/"storyboard.json").read_text())}
def seconds(t):
    m,s=t.split(":")
    return int(m)*60+int(s)

rows = [line.split("|")[1:-1] for line in (repo/"docs/submission/video-script.md").read_text().splitlines() if re.match(r"\| \d:",line)]
for row in rows[1:]:
    time, _, text, _ = [s.strip() for s in row]
    start,end = [seconds(t) for t in time.split("–")]
    if end==175: end=178  # keep the complete closing copy at the existing voice speed
    sentences = re.split(r"(?<=[.!?])\s+",text)
    chunks=[]
    for sentence in sentences:
        if chunks and len((chunks[-1]+" "+sentence).split())<=23:
            chunks[-1]+=" "+sentence
        else: chunks.append(sentence)
    audios=[]
    for chunk in chunks:
        parts=[a.numpy() if hasattr(a,"numpy") else a for _,_,a in pipeline(chunk,voice=voice,speed=1.10)]
        audio=np.concatenate(parts)
        if not np.isfinite(audio).all() or np.max(np.abs(audio))>=1: raise RuntimeError("Invalid/clipped synthesis")
        audios.append(audio)
    durations=[len(a)/24000 for a in audios]
    available=end-start-.5
    speech=sum(durations)
    gap=.30
    if speech+gap*(len(chunks)-1)>available:
        raise RuntimeError(f"{time}: {speech:.2f}s speech + gaps exceeds {available:.2f}s; adjust picture/copy, never stretch audio")
    # Real gaps between short chunks; remaining slack follows the last line.
    for chunk,audio,duration in zip(chunks,audios,durations):
        i=len(records)
        anchor,offset,deadline=placements[i]
        cursor=scene_starts[anchor]+offset
        if cursor+duration>deadline-.05:
            raise RuntimeError(f"Cue {i} overflows its picture window: {cursor:.3f}+{duration:.3f}>{deadline}")
        if records and cursor<records[-1]["start"]+records[-1]["duration"]+.1:
            raise RuntimeError(f"Cue {i} overlaps the previous cue")
        pos=round(cursor*24000)
        master[pos:pos+len(audio)]=audio
        sf.write(out/f"cue-{i:02}.wav",audio,24000,subtype="PCM_16")
        records.append(dict(id=f"cue-{i:02}",anchor=anchor,offset=offset,start=round(cursor,3),duration=round(duration,3),text=chunk))
    print(f"{time}: {len(chunks)} chunks, {speech:.2f}s speech; storyboard anchored; ends {cursor+duration:.2f}s",flush=True)

assert len(records)==len(placements)
assert " ".join(c["text"] for c in records)==" ".join(row[2].strip() for row in rows[1:])
sf.write(out/"narration-raw.wav",master,24000,subtype="PCM_16")
(root/"cues.json").write_text(json.dumps(records,indent=2)+"\n")
(root/"narration.md").write_text("# Backroom rough cut — Kokoro af_heart\n\nFirst 10 seconds: silent placeholder for Varun’s camera and original audio. Remaining copy is verbatim from video-script.md. Closing picture extends to 2:58 to retain the complete copy without time stretching.\n\n| Start | Speech length | Narration |\n| --- | --- | --- |\n"+"".join(f'| {c["start"]:.3f}s | {c["duration"]:.3f}s | {c["text"]} |\n' for c in records))
def stamp(t,sep):
    ms=round(t*1000)
    return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{sep}{ms%1000:03}"
(root/"captions.srt").write_text("\n".join(f'{i+1}\n{stamp(c["start"],",")} --> {stamp(c["start"]+c["duration"],",")}\n{c["text"]}\n' for i,c in enumerate(records)))
(root/"captions.vtt").write_text("WEBVTT\n\n"+"\n".join(f'{stamp(c["start"],".")} --> {stamp(c["start"]+c["duration"],".")}\n{c["text"]}\n' for c in records))
print("Voice: Kokoro 0.9.4 / af_heart / CPU / speed 1.10; pinned offline weights; no time stretching; 10-second reserved opening.")
