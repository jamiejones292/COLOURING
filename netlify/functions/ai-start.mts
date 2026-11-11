import { aiEnabled, json, passcodeRequired, sameOrigin, store } from '../lib/aiShared.mts';

/**
 * POST { image: dataURL (jpeg/png/webp), passcode? } -> { id }
 * Stores the picture and kicks off the background redraw job.
 * GET -> { enabled, passcode } so the app knows whether to show the button.
 */
const MAX_BYTES = 4 * 1024 * 1024;

export default async (req: Request) => {
  if (req.method === 'GET') return json({ enabled: aiEnabled(), passcode: passcodeRequired() });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  if (!aiEnabled()) return json({ error: 'AI redraw is not set up on this site.' }, 503);

  let body: { image?: string; passcode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  if (passcodeRequired() && body.passcode !== process.env.AI_PASSCODE) {
    return json({ error: 'passcode', message: 'That grown-up passcode is not right.' }, 401);
  }

  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.image ?? '');
  if (!m) return json({ error: 'Please send a JPG, PNG or WEBP picture.' }, 400);
  if (m[2].length * 0.75 > MAX_BYTES) return json({ error: 'That picture is too big.' }, 413);

  // simple daily cap to protect your OpenAI bill
  const s = store();
  const limit = Number(process.env.AI_DAILY_LIMIT || 40);
  const dayKey = `count/${new Date().toISOString().slice(0, 10)}`;
  const used = Number((await s.get(dayKey)) || 0);
  if (used >= limit) return json({ error: 'The magic is resting for today. Please try again tomorrow!' }, 429);
  await s.set(dayKey, String(used + 1));

  const id = Date.now().toString(36) + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await s.setJSON(`job/${id}`, { status: 'pending', mime: `image/${m[1]}`, created: Date.now() });
  await s.set(`in/${id}`, m[2]);

  // Background functions return 202 immediately and may run for up to 15 minutes.
  const res = await fetch(new URL('/.netlify/functions/ai-redraw-background', req.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok && res.status !== 202) {
    await s.setJSON(`job/${id}`, { status: 'error', error: 'Could not start the magic. Please try again.' });
  }
  return json({ id });
};
