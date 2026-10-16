// POST /api/narrate { beats: [...], gaps: [{t0,t1}...], persona: 'cinematic'|'child'|'radio'|'custom', language: 'en'|'es'|'fr'|'de'|'pt'|'ja'|'ar', custom?: string }
// Writes narration per gap in 3 lengths (full/tight/glimpse) so the client can fit speech to silence deterministically.
import { chat, parseJsonLoose, amdConfigured, backend } from './_amd.js';

const PERSONA = {
  cinematic: 'a warm, precise film-audio-describer for a blind cinephile: visual grammar, light, movement, mood; never talk over dialogue; no spoilers of what has not happened yet',
  child: 'an excited, kind storyteller for a 7-year-old: simple words, wonder, gentle explanations; never frightening',
  radio: 'a hands-free "radio cut" for a sighted person who is busy: include essential dialogue recap plus visuals, like a sports radio call',
  custom: '',
};
const LANG = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', ja: 'Japanese', ar: 'Arabic' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { beats, gaps, persona, language, custom } = req.body || {};
    if (!amdConfigured()) return res.status(200).json({ demo: true, narration: [] });
    if (!beats || !gaps) return res.status(400).json({ error: 'beats and gaps required' });
    const style = persona === 'custom' ? custom : PERSONA[persona] || PERSONA.cinematic;
    const lang = LANG[language] || 'English';
    const sys = `You are an audio-narration writer: ${style}. Write narration in ${lang}.
For each dialogue gap you get its duration in seconds and the scene beats near it.
For each gap return THREE variants of one narration line:
- "full": rich version sized to the gap at ~150 words per minute,
- "tight": one short sentence,
- "glimpse": 3-6 words for tiny gaps.
Ground every line in the beats given. Never invent events. If a beat's confidence is low, hedge visibly ("it looks like...").
Respond with one JSON object: {"narration": [{"gap": index, "full": string, "tight": string, "glimpse": string, "grounded_in": [beat indexes], "hedged": boolean}]}`;
    const sysFinal = sys;
    const out = await chat({
      messages: [
        { role: 'system', content: sysFinal },
        { role: 'user', content: `Gaps (seconds): ${JSON.stringify(gaps)}\nBeats: ${JSON.stringify(beats)}` },
      ],
      json: true, maxTokens: 4000,
    });
    res.status(200).json({ ...parseJsonLoose(out), meta: backend() });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
