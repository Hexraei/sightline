// POST /api/watch { frames: [dataURL...], times: [seconds...], transcript?: [{t0,t1,text}] }
// VLM pass: grounded scene beats with per-beat confidence. Never invents off-frame facts.
import { chat, parseJsonLoose, amdConfigured, backend } from './_amd.js';

const SYSTEM = `You are watching sampled frames from a video, each with its timestamp. Write scene beats for an audio-narration writer.
Rules:
- Describe ONLY what is visible in the frames. If something important likely happens between samples, say "unseen" instead of guessing.
- No character names unless a name is spoken in the provided transcript; otherwise describe ("the older man", "the girl").
- Each beat: {"t": seconds, "visual": string (one sentence, present tense), "confidence": 0..1, "basis": "what in the frame supports this"}.
- Confidence: 0.9+ unambiguous; below 0.6 ambiguous or dark frame.
Respond with a single JSON object: {"beats": [...]}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { frames, times, transcript } = req.body || {};
    if (!amdConfigured()) return res.status(200).json({ demo: true, beats: [] });
    if (!Array.isArray(frames) || !frames.length) return res.status(400).json({ error: 'frames required' });
    const content = [{ type: 'text', text: `Frames with timestamps (seconds): ${JSON.stringify(times || [])}${transcript ? `\nDialogue transcript: ${JSON.stringify(transcript)}` : ''}\nWrite the scene beats.` }];
    for (const f of frames) content.push({ type: 'image_url', image_url: { url: f } });
    const out = await chat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }], json: true, maxTokens: 3000 });
    res.status(200).json({ ...parseJsonLoose(out), meta: { ...backend(), model: chat.usedModel || backend().model } });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
