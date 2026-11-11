import { createCanvas, ctx2d } from './imageProcessing';

/**
 * Client for the optional "AI Magic Redraw" Netlify functions.
 * The OpenAI key lives only on the server; the browser never sees it.
 */
const BASE = '/.netlify/functions';

export interface AiStatus {
  enabled: boolean;
  passcode: boolean;
}

export async function getAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch(`${BASE}/ai-start`, { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return { enabled: false, passcode: false };
    const d = await res.json();
    return { enabled: !!d.enabled, passcode: !!d.passcode };
  } catch {
    return { enabled: false, passcode: false };
  }
}

export class AiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** Shrink to max 1024px on white and encode as JPEG (keeps uploads small). */
function toUploadDataUrl(src: HTMLCanvasElement): string {
  const s = Math.min(1, 1024 / Math.max(src.width, src.height));
  const c = createCanvas(Math.round(src.width * s), Math.round(src.height * s));
  const ctx = ctx2d(c, false);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Returns a data URL of the redrawn colouring page. */
export async function aiRedraw(src: HTMLCanvasElement, passcode: string | undefined, signal: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/ai-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: toUploadDataUrl(src), passcode }),
      signal,
    });
  } catch {
    throw new AiError('Could not reach the magic. Are you online?');
  }
  const start = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(start.message || start.error || 'The magic did not start.', start.error === 'passcode' ? 'passcode' : undefined);

  const deadline = Date.now() + 4 * 60 * 1000;
  await sleep(6000);
  while (Date.now() < deadline) {
    if (signal.aborted) throw new AiError('Cancelled', 'cancelled');
    try {
      const r = await fetch(`${BASE}/ai-status?id=${encodeURIComponent(start.id)}`, { cache: 'no-store', signal });
      const d = await r.json();
      if (d.status === 'done' && d.image) return d.image as string;
      if (d.status === 'error') throw new AiError(d.error || 'The magic did not work this time.');
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (signal.aborted) throw new AiError('Cancelled', 'cancelled');
      // network blip — keep polling
    }
    await sleep(3000);
  }
  throw new AiError('The magic took too long. Please try again.');
}
