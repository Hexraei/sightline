# lablab.ai submission draft - Sightline (Team Maverick, AMD Developer Hackathon ACT III)
For Navin's review. He clicks the final submit on lablab. Deadline Oct 18, 2026, 3:30 PM IST.

## Title
Sightline - one film, a million tellings

## Short description (tagline length)
AI audio description that fits the silences between dialogue - regenerated for every listener, in their own language, on AMD Developer Cloud.

## Long description
2.2 billion people live with vision impairment (WHO), and the overwhelming majority of film and video has no audio description at all. Professional AD is human-written and human-voiced - too slow and too expensive for the long tail - and where it exists, it is one fixed script: same tone, same language, same detail for everyone.

Sightline rebuilds audio description as something generated, grounded, and personal.

Load a film clip and its subtitle file. An open-weights vision-language model (Gemma 3 27B, served on AMD Developer Cloud's Token Factory) watches sampled frames and writes scene beats - every beat carries a confidence score and the on-frame evidence behind it, so a human reviewer can check anything the model is unsure about before it ships. A deterministic gap-fitter then places narration into the actual silences between dialogue lines: the model writes the words, the code owns the clock, and no narration ever talks over a line of dialogue.

Then the part no fixed AD track can do: the same scene, retold. A cinephile gets visual grammar and mood. A 7-year-old gets wonder and simple words. A busy sighted listener gets a hands-free "radio cut". In English, Spanish, French, German, Portuguese, Japanese, or Arabic - at the click of a button. One film, a million tellings.

Everything runs on AMD Developer Cloud through an OpenAI-compatible API - and because it is open models all the way down, the same app also runs fully offline on a laptop with a local model, for private footage or no-connection settings. Open source under the MIT license.

Track: Agentic / experience applications. AMD stack: AMD Developer Cloud Token Factory (Gemma 3 27B vision + text) for all inference.

## Application URL
https://sightline-ruddy.vercel.app

## GitHub repository (public, MIT)
https://github.com/Hexraei/sightline

## Demo video
[TO ADD - recorded once the AMD key lands and real beats render]

## Cover image
docs/cover.png in the repo (1920x1080)

## Tech tags
AMD Developer Cloud, Token Factory, Gemma 3, vision-language model, OpenAI-compatible API, Vercel, JavaScript, accessibility, audio description, open source

## Checklist against official rules
- [x] Public GitHub repo with MIT license
- [x] Working prototype + application URL (live, auto-deploys from main)
- [x] AMD stack for inference (Token Factory) - pending API key activation
- [ ] Demo video - pending AMD key
- [x] Cover image
- [x] Title / short / long descriptions
- [x] Tech tags
- [x] Original work, built during the hackathon window
