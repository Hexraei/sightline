import { parseVtt, computeGaps, fitLine, speechSeconds, budget, CPS } from './fit.js';
import { startTour, startTourOnce } from './tour.js';

const $ = sel => document.querySelector(sel);
const vid = $('#vid');

const LANGS = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', ja: 'Japanese', ar: 'Arabic' };
const BCP47 = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', ja: 'ja-JP', ar: 'ar-SA' };
const PERSONAS = { cinematic: 'Film lover', child: '7-year-old', radio: 'Hands-free radio cut' };
const FOR_WHOM = { cinematic: 'for a film lover', child: 'for a 7-year-old', radio: 'as a hands-free radio cut' };
const VARIANT_NAME = { full: 'Full', tight: 'Tight', glimpse: 'Glimpse' };
const FRAMES = 8;
const DUCK = 0.25;

const S = {
  name: '', subsName: '', cues: [], gaps: [], frames: [], times: [], beats: [],
  persona: 'cinematic', lang: 'en',
  tellings: new Map(), telling: null, req: 0, busy: false,
};

// ---------- tiny DOM helper (model text only ever goes through textContent) ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter(k => k != null && k !== false));
  return el;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
function tc(s) { // HH:MM:SS.mmm
  const t = Math.max(0, Math.round(s * 1000));
  return `${pad(Math.floor(t / 3600000))}:${pad(Math.floor(t / 60000) % 60)}:${pad(Math.floor(t / 1000) % 60)}.${pad(t % 1000, 3)}`;
}
const short = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const secs = s => `${s.toFixed(1)} s`;
const level = c => (c >= 0.85 ? 'high' : c >= 0.6 ? 'mid' : 'low');
const LEVEL_TEXT = { high: 'Clear', mid: 'Check this', low: 'Unsure, check this' };

// ---------- status line + backend badge ----------
function status(msg, kind = '') {
  const el = $('#status');
  el.textContent = msg;
  el.dataset.kind = kind;
}
function showMeta(data) {
  const el = $('#badge');
  const m = data.meta || {};
  el.hidden = false;
  if (data.mock) { el.dataset.kind = 'mock'; el.textContent = 'Mock response: add AMD_API_KEY to run the real model'; }
  else if (m.local) { el.dataset.kind = 'local'; el.textContent = `Running fully local - ${m.model}`; }
  else { el.dataset.kind = 'cloud'; el.textContent = `Via AMD Developer Cloud - ${m.model}`; }
}

async function api(path, body) {
  let res;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error(`Couldn't reach ${path}. Start the app with "npx vercel dev" and try again.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`${path} failed (${res.status}): ${data.error || res.statusText || 'no details'}`);
  if (data.demo) { // backend has no key configured: canned response so the layout still works
    await new Promise(r => setTimeout(r, 2000));
    return { ...MOCK[path](body), mock: true };
  }
  return data;
}

// ---------- loading media ----------
function resetAnalysis() {
  S.frames = []; S.times = []; S.beats = [];
  S.tellings.clear(); S.telling = null; S.req++;
  renderBeats(); renderNarration();
}

function loadVideo(src, name) {
  stopNarration();
  resetAnalysis();
  S.name = name;
  S.gaps = [];
  vid.src = src;
  status('');
  sync();
}

function setCues(cues) {
  S.cues = cues;
  S.tellings.clear(); S.telling = null; S.req++;
  refreshGaps();
  renderNarration();
}

function refreshGaps() {
  S.gaps = Number.isFinite(vid.duration) ? computeGaps(S.cues, vid.duration) : [];
  renderMap();
}

const isSubs = f => /\.(vtt|srt)$/i.test(f.name);
$('#pick').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const files = [...e.target.files];
  e.target.value = '';
  const video = files.find(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogv)$/i.test(f.name));
  const subs = files.find(isSubs);
  if (!video && !subs) return status('Choose a video file, its subtitle file (.vtt or .srt), or both.', 'error');
  if (video) { S.cues = []; S.subsName = ''; loadVideo(URL.createObjectURL(video), video.name); }
  if (subs) {
    const cues = parseVtt(await subs.text());
    if (!cues.length) return status(`${subs.name} has no subtitle lines Sightline can read. Use a WebVTT (.vtt) or SRT file.`, 'error');
    S.subsName = subs.name;
    setCues(cues);
    if (S.beats.length) tell().catch(fail);
  }
  renderSource();
};
$('#sample').onclick = async () => {
  loadVideo('/assets/sample-scene.mp4', 'Night of the Living Dead (1968), opening scene');
  try {
    const res = await fetch('/assets/sample-scene.vtt');
    if (!res.ok) throw new Error(`sample subtitles returned ${res.status}`);
    S.subsName = 'sample-scene.vtt';
    setCues(parseVtt(await res.text()));
  } catch (e) { fail(new Error(`Couldn't load the sample subtitles: ${e.message}`)); }
  renderSource();
};

vid.addEventListener('loadedmetadata', () => {
  refreshGaps();
  if (!Number.isFinite(vid.duration)) status(`${S.name} has no fixed length, so Sightline can't sample it. Try a saved video file.`, 'error');
  renderSource();
  sync();
});

// Step 1 summary: what is loaded, and what is still missing.
function renderSource() {
  const el = $('#source');
  if (!S.name) return;
  const subs = S.cues.length
    ? `${S.cues.length} lines of dialogue from ${S.subsName}, so Sightline knows when to stay quiet.`
    : 'No subtitles yet, so Sightline treats the whole clip as one long pause. ';
  el.replaceChildren(h('strong', null, S.name), '. ', subs);
  if (!S.cues.length) el.append(h('button', { class: 'link', type: 'button', onclick: () => $('#file').click() }, 'Add subtitles'));
}
vid.addEventListener('error', () => { if (vid.getAttribute('src')) status(`This browser can't play ${S.name}. Try an MP4 (H.264) or WebM file.`, 'error'); sync(); });
vid.addEventListener('timeupdate', movePlayhead);
vid.addEventListener('seeked', movePlayhead);

// ---------- the dials ----------
function setDials(persona, lang) {
  S.persona = persona;
  S.lang = lang;
  $('#lang').value = lang;
  for (const b of document.querySelectorAll('[data-persona]')) b.setAttribute('aria-pressed', String(b.dataset.persona === persona));
}
for (const b of document.querySelectorAll('[data-persona]')) {
  b.onclick = () => {
    setDials(b.dataset.persona, S.lang);
    if (S.beats.length) tell().catch(fail);
  };
}
$('#lang').onchange = e => { setDials(S.persona, e.target.value); if (S.beats.length) tell().catch(fail); };
// ---------- watching ----------
const seek = t => new Promise(resolve => {
  const done = () => { vid.removeEventListener('seeked', done); clearTimeout(timer); resolve(); };
  const timer = setTimeout(done, 3000);
  vid.addEventListener('seeked', done);
  vid.currentTime = t;
});

async function captureFrames() {
  vid.pause();
  const w = Math.min(768, vid.videoWidth), hgt = Math.round(w * vid.videoHeight / vid.videoWidth);
  const canvas = h('canvas', { width: w, height: hgt });
  const ctx = canvas.getContext('2d');
  const frames = [], times = [];
  for (let i = 0; i < FRAMES; i++) {
    const t = +((i + 0.5) * vid.duration / FRAMES).toFixed(2);
    status(`Looking at moment ${i + 1} of ${FRAMES}…`);
    await seek(t);
    ctx.drawImage(vid, 0, 0, w, hgt);
    frames.push(canvas.toDataURL('image/jpeg', 0.8));
    times.push(t);
    S.frames = frames; S.times = times;
    renderBeats(true);
  }
  await seek(0);
  return { frames, times };
}

async function watch() {
  stopNarration();
  resetAnalysis();
  S.busy = true; sync();
  try {
    const { frames, times } = await captureFrames();
    status('Describing what’s on screen…');
    const data = await api('/api/watch', { frames, times, transcript: S.cues.map(c => ({ t0: c.t0, text: c.text })) });
    showMeta(data);
    S.beats = (data.beats || [])
      .map(b => ({ t: Number(b.t) || 0, visual: String(b.visual || ''), confidence: Math.min(1, Math.max(0, Number(b.confidence) || 0)), basis: String(b.basis || '') }))
      .filter(b => b.visual)
      .sort((a, b) => a.t - b.t);
    renderBeats();
    if (!S.beats.length) throw new Error('Sightline couldn’t describe this clip. Press "Watch it with Sightline" to try again, or try a brighter clip.');
    await tell();
  } catch (e) {
    renderBeats();
    fail(e);
  } finally {
    S.busy = false; sync();
  }
}
$('#watch').onclick = watch;

// ---------- narration ----------
function nearestBeat(g) {
  const mid = (g.t0 + g.t1) / 2;
  return S.beats.reduce((a, b) => (Math.abs(b.t - mid) < Math.abs(a.t - mid) ? b : a));
}
function lineConfidence(n, g) {
  const idx = Array.isArray(n.grounded_in) ? n.grounded_in.map(Number).filter(i => S.beats[i]) : [];
  let c = idx.length ? Math.min(...idx.map(i => S.beats[i].confidence)) : nearestBeat(g).confidence;
  if (n.hedged === true) c = Math.min(c, 0.84);
  return c;
}

// Returns the telling for the current dials, from cache or the API; null if superseded by a newer request.
async function tell() {
  const { persona, lang } = S;
  const key = `${persona}|${lang}`;
  if (S.tellings.has(key)) {
    S.telling = S.tellings.get(key);
    renderNarration(); renderMap();
    status(`Narration ${FOR_WHOM[persona]}, in ${LANGS[lang]}, is ready. Press Play with narration to listen.`);
    return S.telling;
  }
  if (!S.gaps.length) throw new Error('This clip has no pauses long enough to describe.');
  const my = ++S.req;
  status(`Writing narration ${FOR_WHOM[persona]}, in ${LANGS[lang]}…`);
  $('#narrPanel').setAttribute('aria-busy', 'true');
  try {
    const data = await api('/api/narrate', {
      beats: S.beats, gaps: S.gaps.map(({ t0, t1 }) => ({ t0, t1 })), persona, language: lang,
    });
    if (my !== S.req) return null;
    showMeta(data);
    const byGap = new Map();
    for (const n of data.narration || []) if (S.gaps[Number(n.gap)]) byGap.set(Number(n.gap), n);
    const lines = S.gaps.map((g, i) => {
      const n = byGap.get(i);
      const fit = n && fitLine(n, g);
      return { g, i, variant: fit?.variant || null, text: fit?.text || '', edited: false, conf: n ? lineConfidence(n, g) : null };
    });
    const t = { key, persona, lang, lines, meta: data.mock ? null : data.meta };
    S.tellings.set(key, t);
    S.telling = t;
    renderNarration(); renderMap();
    const fitted = lines.filter(l => l.text).length;
    const checks = lines.filter(l => l.text && level(l.conf) !== 'high').length;
    status(`Ready: ${fitted} descriptions${checks ? `, ${checks} to check` : ''}. Press Play with narration to listen.`);
    return t;
  } finally {
    if (my === S.req) $('#narrPanel').removeAttribute('aria-busy');
  }
}

// ---------- playback ----------
const P = { on: false, raf: 0, ramp: 0, prev: 0, base: 1, current: null, line: null, capTimer: 0, capUntil: 0 };

function pickVoice(lang) {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  return vs.find(v => /natural|neural|premium|enhanced|google/i.test(v.name)) || vs.find(v => v.localService) || vs[0] || null;
}
if ('speechSynthesis' in window) speechSynthesis.getVoices(); // voices load lazily; ask early

function ramp(to) {
  cancelAnimationFrame(P.ramp);
  const from = vid.volume, start = performance.now();
  const step = now => {
    const k = Math.min(1, (now - start) / 250);
    vid.volume = from + (to - from) * k;
    if (k < 1) P.ramp = requestAnimationFrame(step);
  };
  P.ramp = requestAnimationFrame(step);
}

function showSpeaking(line) {
  P.line = line;
  $('#adline').textContent = line ? line.text : '';
  $('#adline').lang = S.telling?.lang || 'en';
  $('#adline').dir = S.telling?.lang === 'ar' ? 'rtl' : 'ltr';
  for (const el of document.querySelectorAll('.line.speaking')) el.classList.remove('speaking');
  if (!line) return;
  const row = document.querySelector(`.line[data-gap="${line.i}"]`);
  row?.classList.add('speaking');
  row?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function endSpeech() {
  P.current = null;
  clearTimeout(P.capTimer);
  ramp(P.base);
  showSpeaking(null);
}

function speak(line) {
  // The caption stays up for the estimated duration even if no voice can speak it.
  const est = speechSeconds(line.text) * 1000;
  clearTimeout(P.capTimer);
  P.capUntil = performance.now() + est;
  P.capTimer = setTimeout(() => { if (!P.current) showSpeaking(null); }, est);
  showSpeaking(line);
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(line.text);
  const lang = S.telling.lang;
  u.lang = BCP47[lang];
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.onend = u.onerror = () => {
    if (P.current !== u) return;
    P.current = null;
    ramp(P.base);
    if (performance.now() >= P.capUntil) showSpeaking(null);
  };
  P.current = u;
  speechSynthesis.cancel(); // a new silence always wins over a line that overran
  ramp(P.base * DUCK);
  speechSynthesis.speak(u);
}

function tick() {
  if (!P.on) return;
  const now = vid.currentTime;
  const jumped = now < P.prev - 0.25 || now - P.prev > 1.5;
  if (jumped) { if (P.line) { speechSynthesis?.cancel(); endSpeech(); } }
  else if (!vid.paused) {
    for (const l of S.telling.lines) if (l.text && l.g.t0 > P.prev && l.g.t0 <= now) speak(l);
  }
  P.prev = now;
  P.raf = requestAnimationFrame(tick);
}

function startNarration(from = 0) {
  if (!S.telling) return;
  stopNarration();
  P.on = true;
  P.base = vid.volume || 1;
  const lang = S.telling.lang;
  if (!('speechSynthesis' in window)) status('This browser has no speech engine, so narration will show as captions only.', 'error');
  else if (!pickVoice(lang)) status(`No ${LANGS[lang]} voice is installed on this device. The default voice will read the ${LANGS[lang]} lines; captions show the text.`, 'error');
  else status(`Playing the narration ${FOR_WHOM[S.telling.persona]}, in ${LANGS[lang]}. The film’s sound dips while the narrator speaks.`);
  vid.currentTime = from;
  P.prev = from - 0.05;
  vid.play().catch(e => fail(new Error(`Playback didn't start: ${e.message}`)));
  P.raf = requestAnimationFrame(tick);
  sync();
}

function stopNarration() {
  if (!P.on) return;
  P.on = false;
  cancelAnimationFrame(P.raf);
  cancelAnimationFrame(P.ramp);
  clearTimeout(P.capTimer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  P.current = null;
  vid.volume = P.base;
  showSpeaking(null);
  sync();
}

vid.addEventListener('pause', () => { if (P.on && P.line) { speechSynthesis?.cancel(); endSpeech(); } });
vid.addEventListener('ended', () => { stopNarration(); });

$('#play').onclick = () => (P.on ? (vid.pause(), stopNarration(), status('Narration stopped.')) : startNarration(0));

for (const b of document.querySelectorAll('[data-demo]')) {
  b.onclick = async () => {
    stopNarration();
    const [persona, lang] = b.dataset.demo.split('|');
    setDials(persona, lang);
    try {
      const t = await tell();
      if (t && t === S.telling) startNarration(0);
    } catch (e) { fail(e); }
  };
}

// ---------- export ----------
$('#export').onclick = () => {
  const t = S.telling;
  if (!t) return;
  const ad = t.lines.filter(l => l.text);
  const checks = ad.filter(l => level(l.conf) !== 'high').length;
  const model = t.meta ? `${t.meta.model} ${t.meta.local ? '(local)' : 'via AMD Developer Cloud'}` : 'mock response (no model)';
  const events = [
    ...S.cues.map(c => ({ t: c.t0, order: 1, text: `${tc(c.t0)}  ${tc(c.t1)}  DIALOGUE  ${c.text}` })),
    ...ad.map((l, n) => ({
      t: l.g.t0, order: 0,
      text: `${tc(l.g.t0)}  ${tc(l.g.t0 + speechSeconds(l.text))}  AD ${pad(n + 1, 3)}    ${l.edited ? 'EDITED' : l.variant.toUpperCase()}${level(l.conf) !== 'high' ? '  CHECK' : ''}\n${' '.repeat(40)}${l.text}`,
    })),
  ].sort((a, b) => a.t - b.t || a.order - b.order);
  const txt = [
    'SIGHTLINE AUDIO DESCRIPTION SCRIPT',
    '',
    `Programme   ${S.name}`,
    `Listener    ${PERSONAS[t.persona]}`,
    `Language    ${LANGS[t.lang]} (${t.lang})`,
    `Model       ${model}`,
    `Generated   ${new Date().toISOString()}`,
    `Timecode    HH:MM:SS.mmm media time. IN is the start of the silence; OUT is estimated at ${CPS} characters per second.`,
    `Review      ${ad.length} description events, ${checks} marked CHECK for a human look before release.`,
    '',
    'IN            OUT           EVENT',
    '-'.repeat(78),
    ...events.map(e => e.text),
    '',
  ].join('\n');
  const slug = S.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'clip';
  const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' })), download: `sightline-ad-${slug}-${t.persona}-${t.lang}.txt` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  status(`AD script exported: ${ad.length} description events${checks ? `, ${checks} marked CHECK` : ''}.`);
};

// ---------- rendering ----------
function sync() {
  const ready = vid.readyState >= 1 && Number.isFinite(vid.duration);
  $('#watch').disabled = !ready || S.busy;
  $('#watch').textContent = S.busy ? 'Watching…' : 'Watch it with Sightline';
  $('#play').disabled = !S.telling;
  $('#play').textContent = P.on ? 'Stop narration' : 'Play with narration';
  $('#play').setAttribute('aria-pressed', String(P.on));
  $('#export').disabled = !S.telling;
  $('#contrast').hidden = !S.telling;
  $('#screen').toggleAttribute('data-empty', !vid.getAttribute('src'));
  $('#results').hidden = !S.frames.length;
  $('#step-film').classList.toggle('done', ready);
  $('#step-watch').classList.toggle('done', !!S.telling);
}

const frameFor = t => {
  if (!S.times.length) return null;
  let best = 0;
  S.times.forEach((x, i) => { if (Math.abs(x - t) < Math.abs(S.times[best] - t)) best = i; });
  return S.frames[best];
};
const seekBtn = (t, label) => h('button', { class: 'tc', type: 'button', title: `Jump to ${short(t)}`, 'aria-label': `${label}, jump to ${short(t)}`, onclick: () => { vid.currentTime = t; } }, short(t));

function renderBeats(pending = false) {
  const list = $('#beats');
  $('#beatsPanel').setAttribute('aria-busy', String(pending));
  if (pending) {
    list.replaceChildren(...S.frames.map((f, i) => h('li', { class: 'beat pending' },
      h('img', { class: 'thumb', src: f, alt: '' }),
      h('div', null, h('p', { class: 'meta' }, short(S.times[i])), h('p', { class: 'visual' }, 'Looking…')))));
    return;
  }
  if (!S.beats.length) return list.replaceChildren();
  list.replaceChildren(...S.beats.map(b => {
    const lv = level(b.confidence);
    const src = frameFor(b.t);
    return h('li', { class: `beat ${lv}` },
      src ? h('img', { class: 'thumb', src, alt: '' }) : h('span', { class: 'thumb' }),
      h('div', null,
        h('p', { class: 'meta' }, seekBtn(b.t, 'Moment'),
          h('span', { class: `conf ${lv}` }, h('span', { class: 'dot', 'aria-hidden': 'true' }), LEVEL_TEXT[lv])),
        h('p', { class: 'visual' }, b.visual),
        b.basis ? h('p', { class: 'basis' }, `Based on: ${b.basis}`) : null));
  }));
}

// Shown only when an edit no longer fits its pause.
function fitNote(line) {
  const over = speechSeconds(line.text) - budget(line.g);
  return over > 0 ? h('p', { class: 'over' }, `About ${secs(over)} too long for this pause. Shorten it so it doesn’t talk over the dialogue.`) : '';
}

function renderNarration() {
  const t = S.telling;
  const list = $('#narr');
  $('#narrFor').textContent = t ? `${FOR_WHOM[t.persona]}, in ${LANGS[t.lang]}` : '';
  sync();
  if (!t) return list.replaceChildren();
  const told = t.lines.filter(l => l.text);
  const quiet = t.lines.length - told.length;
  $('#narrHint').textContent = `Each line fits a pause in the dialogue. Edit anything before you export.${quiet ? ` ${quiet} pause${quiet > 1 ? 's were' : ' was'} too short and left quiet.` : ''}`;
  list.replaceChildren(...told.map(l => {
    const lv = level(l.conf);
    const id = `line-${l.i}`;
    const variant = h('span', { class: 'variant' }, l.edited ? 'Edited' : VARIANT_NAME[l.variant]);
    const note = h('div', null, fitNote(l));
    const ta = h('textarea', { id, rows: '2', lang: t.lang, dir: t.lang === 'ar' ? 'rtl' : 'ltr', spellcheck: 'true' });
    ta.value = l.text;
    ta.oninput = () => {
      l.text = ta.value; l.edited = true;
      variant.textContent = 'Edited';
      note.replaceChildren(fitNote(l));
    };
    return h('li', { class: `line ${lv}`, 'data-gap': l.i },
      h('p', { class: 'meta' },
        seekBtn(l.g.t0, 'Pause'),
        variant,
        lv === 'high' ? null : h('span', { class: `conf ${lv}` }, h('span', { class: 'dot', 'aria-hidden': 'true' }), LEVEL_TEXT[lv])),
      h('label', { class: 'sr-only', for: id }, `Description at ${short(l.g.t0)}`),
      ta, note);
  }));
}

function renderMap() {
  const d = vid.duration;
  const track = $('#map');
  if (!Number.isFinite(d) || !d) return track.replaceChildren();
  const pct = x => `${(x / d) * 100}%`;
  const lines = S.telling?.lines;
  track.replaceChildren(
    ...S.cues.map(c => h('span', { class: 'seg dialogue', style: `left:${pct(c.t0)};width:${pct(c.t1 - c.t0)}` })),
    ...(lines || []).filter(l => l.text).map(({ g, text }) =>
      h('span', { class: 'seg told', style: `left:${pct(g.t0)};width:${pct(g.t1 - g.t0)}` },
        h('span', { class: 'speech', style: `width:${Math.min(100, (speechSeconds(text) / (g.t1 - g.t0)) * 100)}%` }))),
    h('span', { class: 'playhead', id: 'playhead' }),
  );
  movePlayhead();
}
function movePlayhead() {
  const p = $('#playhead');
  if (p && vid.duration) p.style.left = `${(vid.currentTime / vid.duration) * 100}%`;
}
$('#map').onclick = e => {
  if (!vid.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  vid.currentTime = ((e.clientX - r.left) / r.width) * vid.duration;
};

function fail(e) {
  status(e.message || String(e), 'error');
  console.error(e);
}

// ---------- mock backend (used only when /api/* answers {demo:true}, i.e. no AMD key) ----------
const MOCK_SCENE = [
  ['A car winds along an empty two-lane road through open farmland.', 0.93, 'car and road centred, sharp daylight'],
  ['The car passes through a cemetery gate lined with old trees.', 0.88, 'gate posts and headstones visible behind the car'],
  ['A young woman and a man in a suit walk between headstones carrying a small wreath.', 0.91, 'both figures in full view, wreath in her hands'],
  ['The woman kneels at a grave marker; the man stands back, hands in his pockets.', 0.74, 'faces small in frame, marker text unreadable'],
  ['The man leans toward the woman, grinning; she turns her face away.', 0.82, 'expressions readable in medium shot'],
  ['A lone figure walks slowly among the distant trees.', 0.52, 'figure is tiny and soft-focus at the horizon'],
  ['The figure is closer now, lurching toward the pair across the grass.', 0.64, 'gait visible, face in shadow'],
  ['The woman runs between the gravestones as light fades.', 0.47, 'dark, motion-blurred frame'],
];
const MOCK_VOICE = {
  cinematic: s => s,
  child: s => `Look! ${s.charAt(0).toLowerCase()}${s.slice(1)}`,
  radio: s => `On screen now: ${s.charAt(0).toLowerCase()}${s.slice(1)}`,
};
const MOCK = {
  '/api/watch': ({ times }) => ({
    beats: times.map((t, i) => {
      const [visual, confidence, basis] = MOCK_SCENE[i % MOCK_SCENE.length];
      return { t, visual, confidence, basis: `${basis} (frame ${i + 1})` };
    }),
    meta: null,
  }),
  '/api/narrate': ({ beats, gaps, persona }) => ({
    narration: gaps.map((g, i) => {
      const mid = (g.t0 + g.t1) / 2;
      const b = beats.reduce((a, x) => (Math.abs(x.t - mid) < Math.abs(a.t - mid) ? x : a));
      const full = MOCK_VOICE[persona](b.visual);
      return { gap: i, full, tight: full.split(/[;,]/)[0].replace(/\.?$/, '.'), glimpse: `${b.visual.split(' ').slice(0, 5).join(' ').replace(/[,;.]$/, '')}.` };
    }),
    meta: null,
  }),
};

// ---------- guided tour ----------
const TOUR = [
  { title: 'Welcome to Sightline',
    body: 'Sightline describes a film out loud for people who can’t see the screen. It finds the pauses between lines of dialogue and fills them with a short description of what’s happening. Here’s how it works in five steps.' },
  { target: '#step-film', title: 'Choose a film',
    body: 'Start with the sample scene, or use your own video. Add its subtitle file too, so Sightline knows when people are talking and stays quiet.' },
  { target: '#step-listener', title: 'Choose who’s listening',
    body: 'The same scene is described differently for each listener: rich detail for a film lover, simple words for a child, or a dialogue recap for someone who’s busy. Pick a language too.' },
  { target: '#step-watch', title: 'Let Sightline watch',
    body: 'Sightline looks at 8 moments from the film and writes one description for each pause.' },
  { target: '#results', fallback: '#step-watch', title: 'Check the descriptions',
    body: 'The descriptions appear under the steps. Amber or red marks mean Sightline wasn’t sure, so read those first. You can edit any line, then export the script.' },
  { target: '#playbox', title: 'Listen',
    body: 'Press Play with narration. The film’s sound gets quieter while the narrator speaks. After that, hear the same scene as a different listener with one click.' },
];
$('#tourBtn').onclick = () => startTour(TOUR);

setDials('cinematic', 'en');
status('Start with step 1: choose a film.');
renderBeats(); renderNarration(); renderMap(); sync();
startTourOnce(TOUR);
