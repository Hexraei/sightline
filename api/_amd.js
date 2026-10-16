// Shared AMD Token Factory client (OpenAI-compatible chat completions).
const BASE = () => (process.env.AMD_BASE_URL || '').replace(/\/$/, '');
const KEY = () => process.env.AMD_API_KEY || '';
const MODEL = () => process.env.AMD_MODEL || 'DeepSeek-V4-Flash-Vision-Exp';
// Free shared endpoints are heavily loaded during the hackathon; fall through
// this chain on provider-side 5xx / overload. Order: env model first, then
// proven vision-capable alternates.
const FALLBACK_MODELS = ['DeepSeek-V4-Flash-Vision-Exp', 'Qwen3.8-27B', 'Gemma-4-31B-IT'];

export function backend() {
  const base = BASE();
  return { model: MODEL(), local: /localhost|127\.0\.0\.1/.test(base), base: base.replace(/https?:\/\//, '').split('/')[0] };
}

export function amdConfigured() {
  return Boolean(BASE() && KEY());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOnce(model, payload) {
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, ...payload }),
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(`AMD ${res.status}: ${t.slice(0, 400)}`);
    err.status = res.status;
    err.retryAfter = Number(res.headers.get('retry-after')) || 0;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function chat({ messages, json = false, maxTokens = 4096, temperature = 0.2 }) {
  const payload = {
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };
  const models = [MODEL(), ...FALLBACK_MODELS.filter((m) => m !== MODEL())];
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await callOnce(model, payload);
        chat.usedModel = model;
        return out;
      } catch (e) {
        lastErr = e;
        if (e.status === 429) {
          // Serverless budget is tight: cap the wait, then try the next model.
          await sleep(Math.min(e.retryAfter || 4, 8) * 1000 + Math.random() * 1000);
          continue;
        }
        if (e.status >= 500) break; // provider down/overloaded: next model
        throw e; // 4xx (bad request etc.): fail fast
      }
    }
  }
  throw lastErr;
}

export function parseJsonLoose(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = m ? m[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON in model output');
  return JSON.parse(raw.slice(start, end + 1));
}
