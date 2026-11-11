import type { ColoringEngine } from './engine';
import { canvasToBlob, renderSvgInk } from './imageProcessing';

/** Build a high-resolution flattened image of the artwork. */
export async function renderArtwork(engine: ColoringEngine, svg?: string, maxSide = 3200): Promise<HTMLCanvasElement> {
  const scale = Math.max(1, Math.min(2, maxSide / Math.max(engine.width, engine.height)));
  let line: HTMLCanvasElement | undefined;
  if (svg && scale > 1) {
    // re-render the vector outlines at full export size for razor-sharp lines
    line = await renderSvgInk(svg, Math.round(engine.width * scale), Math.round(engine.height * scale));
  }
  return engine.composite(scale, line);
}

export function safeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artwork';
}

export async function downloadCanvas(c: HTMLCanvasElement, name: string) {
  const blob = await canvasToBlob(c, 'image/png');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(name)}-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Print just the artwork, on its own page. */
export async function printCanvas(c: HTMLCanvasElement, title: string) {
  const blob = await canvasToBlob(c, 'image/png');
  const url = URL.createObjectURL(blob);
  const area = document.getElementById('print-area');
  if (!area) return;
  area.innerHTML = '';
  const img = new Image();
  img.alt = title;
  img.src = url;
  area.appendChild(img);
  await new Promise<void>((res) => {
    if (img.complete) res();
    else img.onload = () => res();
  });
  const cleanup = () => {
    area.innerHTML = '';
    URL.revokeObjectURL(url);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // some mobile browsers never fire afterprint
  setTimeout(cleanup, 60000);
}
