// Shared AMD Token Factory client (OpenAI-compatible chat completions).
const BASE = () => (process.env.AMD_BASE_URL || '').replace(/\/$/, '');
const KEY = () => process.env.AMD_API_KEY || '';
const MODEL = () => process.env.AMD_MODEL || 'Gemma-4-31B-IT';

export function backend() {
  const base = BASE();
  return { model: MODEL(), local: /localhost|127\.0\.0\.1/.test(base), base: base.replace(/https?:\/\//, '').split('/')[0] };
}

export function amdConfigured() {
  return Boolean(BASE() && KEY());
}

export async function chat({ messages, json = false, maxTokens = 4096, temperature = 0.2 }) {
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL(),
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AMD ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export function parseJsonLoose(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = m ? m[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON in model output');
  return JSON.parse(raw.slice(start, end + 1));
}
