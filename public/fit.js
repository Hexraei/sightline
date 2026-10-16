// Gap-fitter. The model writes words; this code owns the clock. Pure and deterministic.
export const CPS = 15;      // estimated speech rate, characters per second
export const PAD = 0.4;     // seconds of silence kept clear inside every gap
export const EDGE_MIN = 4;  // lead-in / tail silences count only when longer than this
export const VARIANTS = ['full', 'tight', 'glimpse'];

const ms = x => Math.round(x * 1000) / 1000;
const seconds = s => s.replace(',', '.').split(':').map(Number).reduce((a, v) => a * 60 + v, 0);
const CUE = /((?:\d+:)?\d{1,2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{3})/;

// WebVTT (and SRT, which differs only in the comma) -> [{t0, t1, text}] sorted by start.
export function parseVtt(text) {
  const cues = [];
  let cur = null;
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = CUE.exec(line);
    if (m) cues.push(cur = { t0: ms(seconds(m[1])), t1: ms(seconds(m[2])), text: '' });
    else if (!line.trim()) cur = null;
    else if (cur) cur.text += (cur.text ? ' ' : '') + line.trim().replace(/<[^>]+>/g, '');
  }
  return cues.filter(c => c.t1 > c.t0).sort((a, b) => a.t0 - b.t0);
}

// Silences between consecutive cues, plus lead-in and tail when longer than EDGE_MIN.
// Gaps no longer than PAD can never hold speech, so they are dropped here.
export function computeGaps(cues, duration) {
  if (!cues.length) return duration > EDGE_MIN ? [{ t0: 0, t1: ms(duration) }] : [];
  const gaps = [];
  if (cues[0].t0 > EDGE_MIN) gaps.push({ t0: 0, t1: cues[0].t0 });
  let end = cues[0].t1;
  for (const c of cues.slice(1)) {
    if (c.t0 - end > PAD) gaps.push({ t0: end, t1: c.t0 });
    end = Math.max(end, c.t1); // overlapping cues extend the dialogue
  }
  if (duration - end > EDGE_MIN) gaps.push({ t0: end, t1: ms(duration) });
  return gaps;
}

export const speechSeconds = text => [...text.trim()].length / CPS;
export const budget = gap => gap.t1 - gap.t0 - PAD;

// Longest variant that fits the gap, full > tight > glimpse; null means skip the gap.
export function fitLine(variants, gap) {
  for (const variant of VARIANTS) {
    const text = String(variants[variant] || '').trim();
    if (text && speechSeconds(text) <= budget(gap) + 1e-9) return { variant, text };
  }
  return null;
}
