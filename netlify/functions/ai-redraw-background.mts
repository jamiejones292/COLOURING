import { REDRAW_PROMPT, store, validId } from '../lib/aiShared.mts';

/**
 * Background function (the "-background" suffix gives it up to 15 minutes).
 * Sends the stored picture to OpenAI's image edit API and stores the result.
 */
export default async (req: Request) => {
  let id: string | null = null;
  try {
    id = (await req.json()).id ?? null;
  } catch {
    /* ignore */
  }
  if (!validId(id)) return;
  const s = store();
  const job = (await s.get(`job/${id}`, { type: 'json' })) as { status: string; mime: string } | null;
  const b64 = await s.get(`in/${id}`);
  if (!job || job.status !== 'pending' || !b64) return;

  try {
    const bytes = Buffer.from(b64, 'base64');
    const ext = job.mime.split('/')[1] === 'jpeg' ? 'jpg' : job.mime.split('/')[1];
    const form = new FormData();
    form.append('model', process.env.AI_MODEL || 'gpt-image-1');
    form.append('image', new Blob([bytes], { type: job.mime }), `picture.${ext}`);
    form.append('prompt', REDRAW_PROMPT);
    form.append('size', '1024x1024');
    form.append('quality', process.env.AI_QUALITY || 'medium');
    form.append('output_format', 'png');
    form.append('n', '1');

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { message?: string; code?: string } };
    const out = data.data?.[0]?.b64_json;
    if (!res.ok || !out) {
      console.error('OpenAI error', res.status, data.error?.message);
      const blocked = data.error?.code === 'moderation_blocked';
      throw new Error(blocked ? "The magic couldn't use that picture. Please try a different one." : 'The magic did not work this time. Please try again.');
    }
    await s.set(`out/${id}`, out);
    await s.setJSON(`job/${id}`, { status: 'done' });
  } catch (err) {
    await s.setJSON(`job/${id}`, { status: 'error', error: err instanceof Error ? err.message : 'Something went wrong.' });
  } finally {
    await s.delete(`in/${id}`); // don't keep children's pictures around
  }
};
