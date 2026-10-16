#!/bin/bash
# Gemma vision smoke test for the wake: extract 6 frames from a clip, ask Gemma on AMD to describe them.
# Usage: AMD_API_KEY=... AMD_BASE_URL=... AMD_MODEL=DeepSeek-V4-Flash-Vision-Exp ./test-gemma-vision.sh clip.mp4
set -e
CLIP="${1:-/home/sandbox/sightline/public/assets/test-clip.mp4}"
MODEL="${AMD_MODEL:-DeepSeek-V4-Flash-Vision-Exp}"
rm -rf /tmp/sight_frames && mkdir -p /tmp/sight_frames
if [ "$CLIP" = "photos" ]; then
  for i in 1 2 3 4; do curl -sL --max-time 30 -o /tmp/sight_frames/f0$i.jpg "https://picsum.photos/seed/sight$i/768/512"; done
else
  ffmpeg -y -loglevel error -i "$CLIP" -vf "fps=1,scale=768:-1" -frames:v 6 /tmp/sight_frames/f%02d.jpg
fi
python3 - "$MODEL" <<'PY'
import base64, glob, json, os, sys, urllib.request
model = sys.argv[1]
content = [{"type":"text","text":"These are 6 frames sampled at 1fps from a short video. For each frame, one sentence: what is visibly happening. Then one sentence: the overall scene. If something is unclear, say unclear. JSON: {\"frames\":[...],\"scene\":\"...\"}"}]
for f in sorted(glob.glob('/tmp/sight_frames/*.jpg')):
    b = base64.b64encode(open(f,'rb').read()).decode()
    content.append({"type":"image_url","image_url":{"url":f"data:image/jpeg;base64,{b}"}})
body = json.dumps({"model": model, "messages":[{"role":"user","content":content}], "max_tokens":1200, "temperature":0.2}).encode()
req = urllib.request.Request(os.environ['AMD_BASE_URL'].rstrip('/')+'/chat/completions', data=body,
    headers={'Authorization':'Bearer '+os.environ['AMD_API_KEY'],'Content-Type':'application/json'})
print(urllib.request.urlopen(req, timeout=180).read().decode()[:4000])
PY
