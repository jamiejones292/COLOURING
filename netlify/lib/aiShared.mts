import { getStore } from '@netlify/blobs';

/** Shared helpers for the AI Magic Redraw functions. */

export const store = () => getStore('ai-redraw');

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const aiEnabled = () => !!process.env.OPENAI_API_KEY;
export const passcodeRequired = () => !!process.env.AI_PASSCODE;

/** Stop other websites from calling our functions from a browser. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin GET requests may omit it
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export function validId(id: string | null): id is string {
  return !!id && /^[a-z0-9]{8,40}$/.test(id);
}

/** The instructions sent to the image model — not editable by users. */
export const REDRAW_PROMPT = `Redraw this picture as a children's colouring book page.

Style rules (follow strictly):
- Pure black outlines on a pure white background. Only two colours: black and white. No grey, no colour, no shading, no gradients, no texture, no hatching, no shadows.
- Thick, smooth, even line weight like a bold marker, the same thickness everywhere.
- Every shape must be a fully CLOSED outline with no gaps or breaks, so each area can be filled with a paint bucket without colour leaking into the next area.
- Lines connect cleanly where they meet: no sketchy overlapping strokes and no loose ends.
- Simple, cute, friendly cartoon style suitable for ages 3 to 8, with large areas to colour. Avoid tiny details, fur strokes, small dots and very thin gaps between lines.
- Keep the main subject recognisable, with the same pose and layout, centred. If the picture is a child's drawing, keep their design and proportions and just redraw it neatly.
- Simplify people and pets into friendly cartoon characters with no realistic facial detail.
- Use a simple background (two or three big shapes such as ground, sun or clouds) or leave it plain white.
- Only small solid black areas are allowed, such as eye pupils. Leave everything else white inside.
- No text, no letters, no watermark, no border or frame.`;
