# Sightline

**One film, a million tellings.** Built for the AMD Developer Hackathon: ACT III (Create a New Kind of Experience track).

Over 2 billion people live with vision impairment, and most of the world's video has no audio description because a human-written track costs up to $30 a minute. Sightline turns any video into a living narration: an open multimodal model (Gemma 3) on AMD GPUs watches the film, finds the pauses between dialogue, and writes description that fits them - then re-tells it for each listener. Cinematic for a film lover. Simple and excited for a child. In Spanish, French, Japanese, Arabic, Portuguese or German for a viewer halfway across the world. A hands-free "radio cut" for a sighted viewer cooking dinner.

Persona, language, and detail level are dials. Every narration line is grounded to the frames the model actually saw, with a confidence state and a human-review screen before export.

## Stack

- Frontend: dependency-free single-page app (public/)
- Backend: Vercel serverless functions (api/) calling an OpenAI-compatible endpoint on AMD Developer Cloud (Token Factory)
- Narration engine: deterministic dialogue-gap fitting (no talking over actors)
- Voice: neural text-to-speech in the browser for the demo; export is an AD-ready script

## Safety and truth

Narration is grounded to sampled frames only. Uncertain scene reads are flagged, not smoothed over, and a reviewer can edit any line before export. Demo footage is public-domain.

## Run fully offline (local mode)

Sightline's backend is OpenAI-compatible. Point it at a local model server and nothing leaves your machine - useful for private footage or no-connection demos.

1. Install Ollama from https://ollama.com/download
2. Pull a vision model that fits your GPU: `ollama pull gemma3:4b` (comfortable on an 8GB card; `gemma3:12b` is stronger but slow there)
3. In this repo: `cp .env.example .env` and set:
   - `AMD_BASE_URL=http://localhost:11434/v1`
   - `AMD_API_KEY=ollama`
   - `AMD_MODEL=gemma3:4b`
4. `npx vercel dev` and open http://localhost:3000. The badge under the status line shows which backend served each call (AMD Developer Cloud vs local).

Quality note: a local 4B model is weaker than the 27B cloud model - vaguer beats, occasional invented detail, a couple of seconds per frame. Great for privacy; use AMD Developer Cloud for the judged demo.
