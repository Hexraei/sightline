# Sightline - deck content brief (AMD Developer Hackathon ACT III)

For Navin to hand-build the deck. Full copy-paste text per slide, 3 short bullets per heading, honest status labels (prototype / planned). Numbers: only WHO figure is citation-safe; everything else is labeled. International framing throughout. Team name on lablab: **Maverick**. (Deck branding: your call - Maverick vs IRIZ_.)

Judging lens for this hackathon: working prototype on AMD stack, originality, demo quality. The deck supports the demo video; it is not the star.

---

## Slide 1 - Title
**Sightline**
One film, a million tellings.
AI audio description, regenerated for every listener - built on open models running on AMD Developer Cloud.
Team Maverick - AMD Developer Hackathon ACT III

## Slide 2 - The problem
**Audio description is scarce, expensive, and one-size-fits-all.**
- 2.2 billion people live with vision impairment (WHO). Most video content has no audio description at all.
- Professional AD is human-written and human-voiced - too slow and costly to cover the long tail of film and video.
- Even where AD exists, it is one fixed script: same tone, same language, same detail level for every listener.

## Slide 3 - The idea
**Sightline watches a film and writes the narration a specific listener needs, in their language.**
- Load a clip + subtitles. An open vision-language model describes what is actually on screen - every claim tied to a frame and timestamp.
- A deterministic gap-fitter places narration into the silences between dialogue. The model writes words; the code owns the clock.
- Regenerate the same scene for a cinephile, a child, or a hands-free listener - in 7 languages - at a click.

## Slide 4 - Why now
**Open models crossed the quality line, and AMD makes them cheap to run.**
- Open-weight VLMs (Gemma 3 27B) now produce grounded scene descriptions good enough for narration drafts. (prototype - see demo)
- AMD Developer Cloud Token Factory serves them behind an OpenAI-compatible API - no infra to build. (prototype)
- The missing piece was never the model - it is timing narration into dialogue gaps. That part is deterministic code. (prototype)

## Slide 5 - How it works
**Watch. Fit. Tell.**
- Watch: sampled frames + subtitle transcript -> /api/watch -> scene beats with per-beat confidence and evidence basis.
- Fit: subtitle gaps -> longest narration variant that fits each silence (full / tight / glimpse) - no LLM timing guesses.
- Tell: speech synthesis speaks fitted lines while the film's audio ducks underneath; export a broadcast-style AD script.

## Slide 6 - Why it is different
**One film, a million tellings - with a human in the loop.**
- Persona x language dials: same scene re-narrated as cinephile / child / radio cut, in EN / ES / FR / DE / PT / JA / AR. (prototype)
- Grounded review: every beat carries a confidence dot and its on-frame evidence; low-confidence lines are flagged for human check before export. (prototype)
- Runs on AMD cloud or fully offline on a laptop with a local model - footage never has to leave the machine. (prototype)

## Slide 7 - Tech
**Boring where it should be, clever where it counts.**
- AMD Developer Cloud Token Factory: gemma-3-27b-it vision + text via OpenAI-compatible API (env: AMD_BASE_URL / AMD_API_KEY / AMD_MODEL). (prototype)
- Web app: static frontend + Vercel serverless routes (/api/watch, /api/narrate); MIT-licensed open source, public repo. (prototype)
- Local mode: same code points at Ollama (gemma3:4b) for offline/private use. (prototype)

## Slide 8 - Roadmap
**From hackathon prototype to an AD copilot. (all planned)**
- Speaker-diarized dialogue + face recognition for "who is on screen" grounding. (planned)
- Batch pipeline: full films in, reviewed AD scripts out, in industry formats (TTML/DAISY). (planned)
- Creator self-serve: indie filmmakers ship AD tracks for every upload, in every language. (planned)

---

Numbers audit: only "2.2 billion (WHO)" is citation-safe. If you want cost-per-minute AD figures or AD coverage percentages, they need a source before slide time - say the word and I'll find citable ones. Demo screenshots for slides 5-6 come from the deployed app once the AMD key lands.
