# Build the Sightline FRONTEND - AMD Developer Hackathon ACT III

Build the frontend for **Sightline**, a web app that makes films watchable for blind and low-vision people with AI audio description. The backend API routes already exist (contract below) - your job is the entire browser experience: the player, the dials, the panels, the review flow, the polish. Work in the existing repo structure: static files in `public/`, no framework, no build step (vanilla JS + modern CSS). `npx vercel dev` must run it immediately.

## The concept

Load a film clip plus its subtitle file; Sightline watches sampled frames, writes grounded scene beats, finds the silences between dialogue, and writes narration that fits into those silences - spoken aloud with the film's audio ducked underneath. The twist: **one film, a million tellings**. The same scene can be re-narrated for different listeners - a cinephile, a 7-year-old, a busy sighted listener wanting a hands-free "radio cut" - in their own language, at a click.

International product. All copy and framing global, no single-country or single-language framing. Language dial: English, Spanish, French, German, Portuguese, Japanese, Arabic.

## The screens / flow (one page, in order)

1. **The film** panel: video player; "Load a clip" (video file), "Load subtitles (.vtt)", and "Use the sample scene" buttons (sample loads `/assets/sample-scene.mp4` + `/assets/sample-scene.vtt`).
2. **The dials**: persona pills - "Film lover", "7-year-old", "Hands-free radio cut" (plus a custom-persona text option if it stays clean) - and the language select.
3. **"Watch it with Sightline"** button: capture 8 evenly-spaced frames from the video via canvas (timestamp each), POST to `/api/watch`.
4. **"What the model saw"** panel: the returned beats, each with a confidence dot (green >= 0.85, amber >= 0.6, red below) and its `basis` string visible. This is the grounded-review affordance: amber/red tells a human to check that line before export.
5. **"The narration, per listener"** panel: after `/api/narrate` returns, one editable text box per subtitle gap showing the fitted variant (label which variant fit: full / tight / glimpse), plus an **Export AD script** button (downloads a broadcast-style audio-description script, .txt with timecodes).
6. **Playback**: "Play with narration" - `speechSynthesis` speaks each fitted line at its gap start (pick a voice matching the selected language; fall back gracefully), ducking the video volume to ~0.25 during speech.
7. **The contrast row** (the wow moment): three buttons - "Cinephile - EN", "Child - ES", "Radio cut - JA" - replay the same scene with different persona/language narration. Hidden until narration exists.
8. **Status line + backend badge**: API errors surface in a status line (no silent failures); after each API call show the returned `meta` as a small badge - green "via AMD Developer Cloud - {model}" or amber "running fully local - {model}".

## Gap-fitter (client-side, deterministic - own this)

Parse the VTT into cues; compute gaps (silences) between consecutive cues (start of next cue minus end of current; also before first cue and after last if > 4s). For each gap, pick the longest narration variant whose estimated speech duration fits: `chars / 15` seconds per variant, gap minus 0.4s padding. Order: full > tight > glimpse; skip the gap if even glimpse doesn't fit. The model writes words; the code owns the clock - never ask the LLM for timing.

## API contract (STABLE - already deployed, do not change)

Both routes are OpenAI-compatible wrappers over AMD Developer Cloud Token Factory (model `gemma-3-27b-it`), env-configured server-side.

**POST /api/watch**
Request: `{ frames: string[] (jpeg dataURLs), times: number[] (seconds), transcript: [{t0: number, text: string}] }`
Response: `{ beats: [{ t: number, visual: string, confidence: number, basis: string }], meta: { model: string, base: string, local: boolean } }`

**POST /api/narrate**
Request: `{ beats: Beat[], gaps: [{t0: number, t1: number}], persona: "cinematic"|"child"|"radio"|"custom", language: "en"|"es"|"fr"|"de"|"pt"|"ja"|"ar", custom?: string }`
Response: `{ narration: [{ gap: number (index into gaps), full: string, tight: string, glimpse: string }], meta: {...} }`

Errors: non-200 with `{ error: string }`.

## Design bars

Dark, cinematic, tasteful. This is a hackathon demo the judges will watch as a video: generous type, calm motion, the beats/narration panels must read well at 1080p screen capture. No purple-gradient AI slop; think Criterion, not SaaS. Mobile-degrade gracefully but desktop-first.

## Constraints

- Deadline Oct 18, 2026, 3:30 PM IST. Scope accordingly; a polished single page beats two rough ones.
- Don't touch `api/` - the contract above is frozen. Mock it locally if the key isn't set (a 2-second delayed canned response is fine for layout work).
- MIT-licensed open-source repo; no copied UI kits with incompatible licenses.
- Sample footage is public domain (Night of the Living Dead, 1968) - keep attribution in the footer.
