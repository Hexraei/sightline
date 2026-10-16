// First-visit guided tour: dims the page, spotlights one part at a time, explains it in a card.
// Steps: [{ title, body, target?: selector, fallback?: selector used while target is hidden }]
const SEEN = 'sightline.tour.v1';

export function startTourOnce(steps) {
  let seen = null;
  try { seen = localStorage.getItem(SEEN); } catch { /* storage blocked: show the tour */ }
  if (!seen) startTour(steps);
}

export function startTour(steps) {
  if (document.querySelector('.tour')) return;
  const opener = document.activeElement;
  const page = [...document.body.children];
  let i = 0;

  const spot = el('div', 'tour-spot');
  const count = el('p', 'count');
  const title = el('h2');
  const body = el('p');
  const back = button('Back', 'btn');
  const next = button('Next', 'btn primary');
  const skip = button('Skip tour', 'link');
  const card = el('div', 'tour-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-live', 'polite');
  title.id = 'tour-title';
  body.id = 'tour-body';
  card.setAttribute('aria-labelledby', title.id);
  card.setAttribute('aria-describedby', body.id);
  const nav = el('div', 'row');
  const pair = el('div', 'row');
  pair.append(back, next);
  nav.append(skip, pair);
  card.append(count, title, body, nav);
  const root = el('div', 'tour');
  root.append(spot, card);

  const target = () => {
    const s = steps[i];
    for (const sel of [s.target, s.fallback]) {
      const t = sel && document.querySelector(sel);
      if (t && t.getClientRects().length) return t;
    }
    return null;
  };

  function place() {
    const t = target();
    const vw = innerWidth, vh = innerHeight;
    if (!t) {
      spot.className = 'tour-spot none';
      card.style.left = `${(vw - card.offsetWidth) / 2}px`;
      card.style.top = `${Math.max(16, (vh - card.offsetHeight) / 2)}px`;
      return;
    }
    const r = t.getBoundingClientRect();
    const pad = 8;
    spot.className = 'tour-spot';
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    // Beside the target when there's room (wide screens), otherwise below or above it.
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 20;
    let left, top;
    if (r.left - gap - cw > 16) { left = r.left - gap - cw; top = r.top; }
    else if (r.right + gap + cw < vw - 16) { left = r.right + gap; top = r.top; }
    else {
      left = r.left;
      top = r.bottom + gap + ch < vh ? r.bottom + gap : r.top - gap - ch;
    }
    card.style.left = `${Math.min(Math.max(16, left), vw - cw - 16)}px`;
    card.style.top = `${Math.min(Math.max(16, top), vh - ch - 16)}px`;
  }

  function show() {
    const s = steps[i];
    count.textContent = `${i + 1} of ${steps.length}`;
    title.textContent = s.title;
    body.textContent = s.body;
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? 'Start' : 'Next';
    // Phones show the card as a bottom sheet, so keep the target near the top.
    const narrow = matchMedia('(max-width: 640px)').matches;
    const t = target();
    if (t) { t.scrollIntoView({ block: narrow ? 'start' : 'center' }); if (narrow) scrollBy(0, -16); }
    place();
    next.focus();
  }

  function end() {
    root.remove();
    for (const n of page) n.inert = false;
    removeEventListener('resize', place);
    removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', key);
    try { localStorage.setItem(SEEN, '1'); } catch { /* fine: tour shows again next visit */ }
    opener?.focus?.();
  }

  function key(e) {
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight' && i < steps.length - 1) { i++; show(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; show(); }
  }

  next.onclick = () => (i === steps.length - 1 ? end() : (i++, show()));
  back.onclick = () => { i--; show(); };
  skip.onclick = end;

  for (const n of page) n.inert = true; // keeps keyboard and screen readers inside the tour
  document.body.append(root);
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  document.addEventListener('keydown', key);
  show();
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}
function button(label, cls) {
  const b = el('button', cls);
  b.type = 'button';
  b.textContent = label;
  return b;
}
