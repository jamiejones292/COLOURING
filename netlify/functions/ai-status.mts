import { json, sameOrigin, store, validId } from '../lib/aiShared.mts';

/** GET ?id=… -> { status: 'pending' | 'done' | 'error', image?, error? } */
export default async (req: Request) => {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const id = new URL(req.url).searchParams.get('id');
  if (!validId(id)) return json({ error: 'Bad request' }, 400);
  const s = store();
  const job = (await s.get(`job/${id}`, { type: 'json' })) as { status: string; error?: string; created?: number } | null;
  if (!job) return json({ status: 'error', error: 'That job has expired.' }, 404);

  if (job.status === 'done') {
    const image = await s.get(`out/${id}`);
    // one-time pickup: delete everything once the app has the picture
    await Promise.all([s.delete(`out/${id}`), s.delete(`job/${id}`)]);
    return json({ status: 'done', image: `data:image/png;base64,${image}` });
  }
  if (job.status === 'error') {
    await s.delete(`job/${id}`);
    return json({ status: 'error', error: job.error });
  }
  if (job.created && Date.now() - job.created > 5 * 60 * 1000) {
    return json({ status: 'error', error: 'The magic took too long. Please try again.' });
  }
  return json({ status: 'pending' });
};
