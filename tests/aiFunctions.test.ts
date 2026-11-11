import { describe, it, expect, vi, beforeEach } from 'vitest';

// in-memory stand-in for Netlify Blobs
const mem = new Map<string, string>();
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async (k: string, o?: { type?: string }) => {
      const v = mem.get(k);
      if (v === undefined) return null;
      return o?.type === 'json' ? JSON.parse(v) : v;
    },
    set: async (k: string, v: string) => void mem.set(k, v),
    setJSON: async (k: string, v: unknown) => void mem.set(k, JSON.stringify(v)),
    delete: async (k: string) => void mem.delete(k),
  }),
}));

const start = (await import('../netlify/functions/ai-start.mts')).default;
const background = (await import('../netlify/functions/ai-redraw-background.mts')).default;
const status = (await import('../netlify/functions/ai-status.mts')).default;

const SITE = 'https://paint-splash.netlify.app';
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');
const post = (body: unknown, origin = SITE) =>
  new Request(`${SITE}/.netlify/functions/ai-start`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });

let openaiCalls: FormData[] = [];
beforeEach(() => {
  mem.clear();
  openaiCalls = [];
  process.env.OPENAI_API_KEY = 'sk-test';
  delete process.env.AI_PASSCODE;
  delete process.env.AI_DAILY_LIMIT;
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ai-redraw-background')) return new Response(null, { status: 202 });
    if (u.includes('api.openai.com')) {
      openaiCalls.push(init!.body as FormData);
      return new Response(JSON.stringify({ data: [{ b64_json: 'UE5HREFUQQ==' }] }), { status: 200 });
    }
    throw new Error('unexpected fetch ' + u);
  });
});

describe('AI magic redraw functions', () => {
  it('reports whether AI is enabled', async () => {
    const r = await start(new Request(`${SITE}/.netlify/functions/ai-start`));
    expect(await r.json()).toEqual({ enabled: true, passcode: false });
    delete process.env.OPENAI_API_KEY;
    const r2 = await start(new Request(`${SITE}/.netlify/functions/ai-start`));
    expect((await r2.json()).enabled).toBe(false);
  });

  it('runs the full job: start -> background -> status (one-time pickup)', async () => {
    const r = await start(post({ image: IMG }));
    expect(r.status).toBe(200);
    const { id } = await r.json();
    expect(mem.has(`in/${id}`)).toBe(true);

    const pending = await (await status(new Request(`${SITE}/x?id=${id}`))).json();
    expect(pending.status).toBe('pending');

    await background(new Request(`${SITE}/bg`, { method: 'POST', body: JSON.stringify({ id }) }));
    expect(openaiCalls).toHaveLength(1);
    const form = openaiCalls[0];
    expect(form.get('model')).toBe('gpt-image-1');
    expect(String(form.get('prompt'))).toContain('CLOSED outline');
    expect(form.get('image')).toBeInstanceOf(Blob);
    expect(mem.has(`in/${id}`)).toBe(false); // input deleted

    const done = await (await status(new Request(`${SITE}/x?id=${id}`))).json();
    expect(done).toEqual({ status: 'done', image: 'data:image/png;base64,UE5HREFUQQ==' });
    expect([...mem.keys()].filter((k) => k.includes(id))).toHaveLength(0); // nothing kept
  });

  it('requires the passcode when one is set', async () => {
    process.env.AI_PASSCODE = 'crayons';
    expect((await start(post({ image: IMG }))).status).toBe(401);
    expect((await start(post({ image: IMG, passcode: 'nope' }))).status).toBe(401);
    expect((await start(post({ image: IMG, passcode: 'crayons' }))).status).toBe(200);
  });

  it('rejects other websites and bad images', async () => {
    expect((await start(post({ image: IMG }, 'https://evil.example'))).status).toBe(403);
    expect((await start(post({ image: 'data:text/html;base64,AAAA' }))).status).toBe(400);
  });

  it('enforces the daily limit', async () => {
    process.env.AI_DAILY_LIMIT = '2';
    expect((await start(post({ image: IMG }))).status).toBe(200);
    expect((await start(post({ image: IMG }))).status).toBe(200);
    expect((await start(post({ image: IMG }))).status).toBe(429);
  });

  it('turns OpenAI failures into a friendly error', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      String(url).includes('openai')
        ? new Response(JSON.stringify({ error: { message: 'blocked', code: 'moderation_blocked' } }), { status: 400 })
        : new Response(null, { status: 202 }),
    );
    const { id } = await (await start(post({ image: IMG }))).json();
    await background(new Request(`${SITE}/bg`, { method: 'POST', body: JSON.stringify({ id }) }));
    const d = await (await status(new Request(`${SITE}/x?id=${id}`))).json();
    expect(d.status).toBe('error');
    expect(d.error).toMatch(/different one/);
  });
});
