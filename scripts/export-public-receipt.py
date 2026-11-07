"""Export an allowlisted stage summary; never copy room messages or identities."""
import html
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
h = json.loads((ROOT / '.switch-runtime/block2-health.json').read_text())
stages = [
 ('brief', 'Brief', 'Owner, then client', 'Revised brief replaced the earlier delivery after the client revision.'),
 ('architecture', 'Architecture', 'Owner', 'A question kept the version. A change replaced it. The old approval code was rejected.'),
 ('build', 'Build', 'Owner', 'Earlier review rounds required corrections. Review 3 required an F1 correction; fresh review 4 accepted the final commit. Its review was bounded to F1.'),
 ('client_review', 'Client review', 'Client', 'The native rehearsal changed the confirmation heading and reopened affected approvals. The separate hand rehearsal changed pickup sessions; these are different runs.'),
 ('video', 'Video', 'Owner, then client', 'The exact file required both approvals. Human listening and ASR were not performed.'),
 ('learn', 'Learn', 'Owner', 'Promotion and the older-project fix required separate authorization. The result is a local branch and PR description; no hosted PR was opened.'),
]
events=[]
for key,title,closed,rejected in stages:
 s=h['workflow']['stages'][key]
 version=s['version']
 assert isinstance(version,int) and 0 < version < 100
 assert set(s['approvals']) <= {'owner','client'}
 artifact={'build':'2825b61fa63f','client_review':'2825b61fa63f','video':'SHA-256 9a1629af384c2acbaf18ec3f28990389d20776f2595a98f4236d9308c1a2f6a0','learn':'private-order-lists v1; fix 1c5331d0747c'}.get(key,'document v'+str(version))
 events.append(dict(stage=title,version=version,artifact=artifact,closed_by=closed,approvals='simulated',rejected_or_revised=rejected))
(ROOT/'receipt/public-events.json').write_text(json.dumps({'simulation':True,'source':'recorded rehearsal evidence; persisted rehearsal stage summary','events':events},indent=2)+'\n')
e=html.escape
cards=''.join(f'<li><span class="number">{i}</span><article><h2>{e(x["stage"])}</h2><p class="meta">Workflow v{x["version"]} · Closed by {e(x["closed_by"])}</p><p><strong>Exact artifact:</strong> <code>{e(x["artifact"])}</code></p><p>{e(x["rejected_or_revised"])}</p></article></li>' for i,x in enumerate(events,1))
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Backroom · Public rehearsal receipt</title><style>*{box-sizing:border-box}body{margin:0;background:#101b21;color:#edf4f5;font:17px/1.6 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:48px 24px}h1{font-size:clamp(32px,6vw,56px);line-height:1.1;margin:16px 0}h2{margin:0;font-size:25px}.label{color:#91e5c1;letter-spacing:.1em;font-weight:700}.notice{background:#35402c;border-left:4px solid #e1dc8c;padding:18px 22px}.intro,.meta,footer{color:#b9ccd3}ol{list-style:none;padding:0;margin:40px 0}li{display:flex;gap:20px;margin:0 0 22px}.number{flex:0 0 38px;height:38px;text-align:center;border:1px solid #91e5c1;border-radius:50%;color:#91e5c1;font-weight:700}article{min-width:0;flex:1;padding:22px;background:#1b2b33;border:1px solid #36505c;border-radius:12px}p{margin:10px 0}code{font-size:14px;overflow-wrap:anywhere}footer{border-top:1px solid #36505c;padding-top:22px}@media(max-width:520px){main{padding:28px 16px}li{gap:10px}.number{flex-basis:30px;height:30px;line-height:28px}article{padding:16px}body{font-size:16px}}</style><main><div class="label">BACKROOM / SAMPLE EVIDENCE</div><h1>Six stages.<br>Exact-version decisions.</h1><p class="intro">A fictional bakery rehearsal, summarized from structured stage state. No raw room messages are included.</p><div class="notice"><strong>All owner and client approvals were simulated.</strong> Varun plays both people in the planned real-run recording. Real Discord intake, owner release and client review: [CONFIRM AFTER REAL RUN].</div><ol>'''+cards+'''</ol><footer><p>Sequence note: learning work happened before video. Formal learning closure waited for video acceptance. The cards follow the six-stage plan, not elapsed time.</p><p>Evidence: recorded rehearsal evidence, recorded rehearsal evidence and recorded rehearsal evidence in the repository. This self-contained receipt makes no external requests. Local deployment only. Same-machine agents are not a strong sandbox.</p></footer></main></html>'''
(ROOT/'receipt/public.html').write_text(page)
print('Exported 6 allowlisted simulated stage events to receipt/public-events.json and receipt/public.html')
