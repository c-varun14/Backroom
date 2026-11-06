"""One-command rough cut using existing assets and the repository's video kit."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

root=Path(__file__).resolve().parent
repo=root.parents[2]
out=root/"artifacts"
out.mkdir(exist_ok=True)
env={k:os.environ[k] for k in ("PATH","HOME","LANG","CHROMIUM_EXECUTABLE") if k in os.environ}
env.update(HF_HOME=str(repo/"studio-kit/video/.cache/huggingface"),HF_HUB_OFFLINE="1",XDG_CACHE_HOME=str(repo/"studio-kit/video/.cache"),PLAYWRIGHT_BROWSERS_PATH=str(repo/"studio-kit/video/.cache/ms-playwright"),TOKENIZERS_PARALLELISM="false",PYTHONUNBUFFERED="1")
def run(args, echo=False):
    p=subprocess.run([str(a) for a in args],cwd=repo,env=env,text=True,capture_output=True)
    if p.returncode:
        raise RuntimeError(f"{args[0]} exited {p.returncode}: {p.stderr[-3000:]}{p.stdout[-1500:]}")
    if echo and p.stdout: print(p.stdout.strip(),flush=True)
    return p
def ff(*args): return run(["ffmpeg","-hide_banner","-loglevel","error","-y",*args])
def loudness(path,filters="loudnorm=I=-16:TP=-2:LRA=7"):
    p=run(["ffmpeg","-hide_banner","-i",path,"-af",filters+":print_format=json","-f","null","-"])
    # ffmpeg may print its stream summary after the loudnorm JSON object.
    return json.JSONDecoder().raw_decode(p.stderr[p.stderr.rfind("{"):])[0]
def probe(path): return json.loads(run(["ffprobe","-v","error","-show_format","-show_streams","-of","json",path]).stdout)

parser=argparse.ArgumentParser()
parser.add_argument("--finish-only",action="store_true",help="Reuse already rendered picture and narration")
args=parser.parse_args()
(root/"manifest.json").unlink(missing_ok=True)
if not args.finish_only:
    # Invalidate derived cues before a new take so failed synthesis cannot reuse old timings.
    (root/"cues.json").unlink(missing_ok=True)
    run(["bun","--no-env-file",root/"render.ts"],echo=True)
    run([repo/"studio-kit/video/.venv/bin/python",root/"narrate.py"],echo=True)
    print("MILESTONE: all picture sources rendered and complete timed narration synthesized.",flush=True)
    scenes=json.loads((root/"storyboard.json").read_text())
    source=repo/"workspaces/bakery-live/video/artifacts/bakery-demo.mp4"
    source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
    if source_hash!="9a1629af384c2acbaf18ec3f28990389d20776f2595a98f4236d9308c1a2f6a0":
        raise RuntimeError("Existing bakery footage changed; inspect it before replacing the evidence source")
    parts=[]
    colour=["-colorspace","bt709","-color_primaries","bt709","-color_trc","bt709","-color_range","tv","-chroma_sample_location","left"]
    for s in scenes:
        part=out/f'segment-{s["id"]}.mp4'
        seconds=str(s["end"]-s["start"])
        if "native" in s:
            ff("-ss",str(s["native"]),"-i",source,"-loop","1","-framerate","30","-i",out/f'{s["id"]}.png',"-filter_complex","[0:v]fps=30,setsar=1[base];[base][1:v]overlay=0:0:shortest=1,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]","-map","[v]","-t",seconds,"-an","-c:v","libx264","-preset","fast","-crf","20","-threads","4",*colour,part)
        else:
            ff("-loop","1","-framerate","30","-i",out/f'{s["id"]}.png',"-t",seconds,"-vf","scale=out_color_matrix=bt709:out_range=tv,setsar=1","-an","-c:v","libx264","-preset","fast","-crf","20","-pix_fmt","yuv420p","-threads","4",*colour,part)
        parts.append(part)
        print(f'Encoded {s["id"]}: {seconds}s',flush=True)
    properties=[]
    for part in parts:
        v=probe(part)["streams"][0]
        properties.append(tuple(v.get(k) for k in ("width","height","pix_fmt","sample_aspect_ratio","color_range","color_space","color_transfer","color_primaries","chroma_location","time_base")))
    assert len(set(properties))==1, "Segment properties differ; concatenation would reset frame-sampling filters"
    print("PASS segment contract: all 19 share size, pixel format, SAR, BT.709 color, chroma location and time base.",flush=True)
    (out/"segments.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))
    ff("-f","concat","-safe","0","-i",out/"segments.txt","-map","0:v:0","-c:v","copy","-an","-movflags","+faststart",out/"silent.mp4")

compressor="acompressor=threshold=-26dB:ratio=2.5:attack=15:release=200,loudnorm=I=-16:TP=-2:LRA=7"
m=loudness(out/"narration-raw.wav",compressor)
norm=compressor+f':measured_I={m["input_i"]}:measured_TP={m["input_tp"]}:measured_LRA={m["input_lra"]}:measured_thresh={m["input_thresh"]}:offset={m["target_offset"]}:linear=true'
ff("-i",out/"narration-raw.wav","-af",norm,"-ar","48000","-ac","1",out/"narration.wav")
# Leave codec headroom and encode each delivery format from the WAV master.
# Transcoding AAC into Opus produced an excessive decoded true peak in QC.
codec_guard="volume=0.5dB,alimiter=limit=0.68:level=false:latency=true"
ff("-i",out/"silent.mp4","-i",out/"narration.wav","-i",root/"captions.srt","-map","0:v:0","-map","1:a:0","-map","2:0","-c:v","copy","-af",codec_guard,"-c:a","aac","-b:a","192k","-c:s","mov_text","-metadata:s:s:0","language=eng","-t","178","-movflags","+faststart",out/"backroom-rough.mp4")
ff("-i",out/"silent.mp4","-i",out/"narration.wav","-map","0:v:0","-map","1:a:0","-c:v","libvpx-vp9","-crf","32","-b:v","0","-row-mt","1","-cpu-used","5","-threads","4","-af",codec_guard,"-c:a","libopus","-b:a","96k","-t","178",out/"backroom-rough.webm")
print("MILESTONE: complete 2:58 MP4 and WebM encoded; running media gates.",flush=True)
scenes=json.loads((root/"storyboard.json").read_text())
outputs=[]
for name in ("backroom-rough.mp4","backroom-rough.webm"):
    p=out/name
    meta=probe(p)
    meta["format"]["filename"]=name
    v=next(s for s in meta["streams"] if s["codec_type"]=="video")
    a=next(s for s in meta["streams"] if s["codec_type"]=="audio")
    duration=float(meta["format"]["duration"])
    assert v["width"]==1920 and v["height"]==1080 and v["avg_frame_rate"]=="30/1"
    assert 177.9<=duration<179 and a["sample_rate"]=="48000" and a["channels"]==1
    loud=loudness(p)
    assert abs(float(loud["input_i"])+16)<=.3 and float(loud["input_tp"])<=-1.5, loud
    # Decode the entire picture and sound; no truncated streams accepted.
    ff("-i",p,"-map","0:v:0","-map","0:a:0","-f","null","-")
    black=run(["ffmpeg","-hide_banner","-i",p,"-vf","blackdetect=d=0.15:pix_th=0.04","-an","-f","null","-"])
    assert "black_start:" not in black.stderr, "Unexpected near-black frames"
    sha=hashlib.sha256(p.read_bytes()).hexdigest()
    entry=dict(path=name,bytes=p.stat().st_size,sha256=sha,duration=duration,width=v["width"],height=v["height"],fps=v["avg_frame_rate"],videoCodec=v["codec_name"],pixelFormat=v["pix_fmt"],audioCodec=a["codec_name"],audioSampleRate=a["sample_rate"],audioChannels=a["channels"],loudness=loud,fullDecode=True,blackFrames=False,probe=meta)
    outputs.append(entry)
    print(f'PASS {name}: {duration:.3f}s, 1920x1080, 30fps, {v["codec_name"]}/{a["codec_name"]}, mono 48000Hz, {loud["input_i"]} LUFS, {loud["input_tp"]} dBTP, {p.stat().st_size} bytes; full decode; no black frames. SHA-256 {sha}',flush=True)

for s in scenes:
    ff("-ss",str(s["start"]+.5),"-i",out/"backroom-rough.mp4","-frames:v","1",out/f'final-{s["id"]}.png')
ff("-i",out/"backroom-rough.mp4","-vf","fps=1/5,scale=384:216,tile=6x6","-frames:v","1",out/"contact-sheet.jpg")
ff("-i",out/"backroom-rough.mp4","-vf","select='eq(n,654)+eq(n,678)+eq(n,702)+eq(n,2934)+eq(n,2958)+eq(n,2982)',scale=640:360,tile=3x2","-frames:v","1","-fps_mode","vfr",out/"interaction-sheet.jpg")
silence=run(["ffmpeg","-hide_banner","-i",out/"backroom-rough.mp4","-af","silencedetect=n=-45dB:d=1.5","-vn","-f","null","-"])
silence_lines=[line.split("] ",1)[-1] for line in silence.stderr.splitlines() if "silence_" in line]
(root/"manifest.json").write_text(json.dumps(dict(sample=True,simulation=True,durationTarget=178,openingPlaceholderSeconds=10,source="docs/submission/video-script.md",sourceFootageSha256="9a1629af384c2acbaf18ec3f28990389d20776f2595a98f4236d9308c1a2f6a0",voice="af_heart",engine="kokoro 0.9.4",profile="studio-kit/video/references/voice.md",synthesisSpeed=1.10,timeStretching=False,modelRevision="f3ff3571791e39611d31c381e3a41a3af07b4987",outputs=outputs,silenceSegments=silence_lines,humanListeningPass=False,asrCheck=False),indent=2)+"\n")
print("Silence segments >=1.5 seconds:",flush=True)
print("\n".join(silence_lines),flush=True)
print("PASS: 19 chapter frames, 36-sample full-timeline contact sheet, and two native interaction sequences extracted. Human listening and ASR not performed.",flush=True)
