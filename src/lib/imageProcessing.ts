/**
 * Client-side image processing for turning pictures into colouring pages.
 * Nothing ever leaves the device.
 *
 * Every line-art source ends up as an "ink" layer: a canvas whose pixels are
 * pure black with alpha = how dark the outline is. That layer sits on top of
 * the colours, so outlines always stay visible, and its alpha channel feeds
 * region detection.
 */

export type ConvertMode = 'drawing' | 'photo' | 'asis';

export interface ConvertSettings {
  mode: ConvertMode;
  /** -50..100 */
  contrast: number;
  /** 0..100 — higher picks up fainter lines */
  sensitivity: number;
  /** 0..4 px of extra line thickness */
  thickness: number;
  /** 0..100 — remove specks smaller than this many (scaled) pixels */
  cleanup: number;
}

export const DEFAULT_CONVERT: ConvertSettings = {
  mode: 'drawing',
  contrast: 20,
  sensitivity: 50,
  thickness: 1,
  cleanup: 40,
};

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement, read = true): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: read });
  if (!ctx) throw new Error('Canvas not supported');
  return ctx;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

export function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Convert any RGBA image (on white) into an ink canvas: black + alpha. */
export function luminanceToInk(data: ImageData): ImageData {
  const d = data.data;
  const out = new ImageData(data.width, data.height);
  const o = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const onWhite = 255 - a * (255 - lum);
    o[i + 3] = 255 - onWhite;
  }
  return out;
}

/** Render an SVG drawing to an ink canvas at the requested size. */
export async function renderSvgInk(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const sized = svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
  const img = await loadImage(svgToDataUrl(sized));
  const c = createCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const ink = luminanceToInk(ctx.getImageData(0, 0, w, h));
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(ink, 0, 0);
  return c;
}

/**
 * Render a black-on-white line-art image to an ink canvas whose longest side
 * is `maxSide`, keeping the picture's own shape (portrait, landscape or square).
 */
export async function renderImageInk(url: string, maxSide: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(url);
  const iw = img.naturalWidth || maxSide;
  const ih = img.naturalHeight || maxSide;
  const s = maxSide / Math.max(iw, ih);
  const w = Math.round(iw * s);
  const h = Math.round(ih * s);
  const c = createCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const ink = luminanceToInk(ctx.getImageData(0, 0, w, h));
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(ink, 0, 0);
  return c;
}

/** Ink canvas for a built-in page, whether it is an SVG drawing or a picture. */
export function renderPageInk(page: { svg?: string; image?: string }, size: number): Promise<HTMLCanvasElement> {
  if (page.svg) return renderSvgInk(page.svg, size, size);
  if (page.image) return renderImageInk(page.image, size);
  return Promise.reject(new Error('That page is missing.'));
}

/** Draw a loaded image onto a canvas, scaled to fit `maxSide`. */
export function imageToCanvas(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  let w = img.naturalWidth || img.width || 1200;
  let h = img.naturalHeight || img.height || 1200;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  // small images are scaled UP so lines are thick enough to work with
  const up = Math.max(w, h) < 900 ? 900 / Math.max(w, h) : 1;
  const s = scale < 1 ? scale : up;
  w = Math.max(1, Math.round(w * s));
  h = Math.max(1, Math.round(h * s));
  const c = createCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/** Grayscale (0..255, 255 = white), compositing transparency over white. */
export function toGray(data: ImageData): Float32Array {
  const d = data.data;
  const n = data.width * data.height;
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    const lum = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    g[i] = 255 - a * (255 - lum);
  }
  return g;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const size = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / size;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / size;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

function applyContrast(g: Float32Array, contrast: number) {
  const c = Math.max(-250, Math.min(250, contrast * 2));
  const f = (259 * (c + 255)) / (255 * (259 - c));
  for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, (g[i] - 128) * f + 128));
}

/** Grey-level dilation of ink (max filter). */
function dilateInk(ink: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return ink;
  const tmp = new Float32Array(ink.length);
  const out = new Float32Array(ink.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (ink[row + k] > m) m = ink[row + k];
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (tmp[k * w + x] > m) m = tmp[k * w + x];
      out[y * w + x] = m;
    }
  }
  return out;
}

/** Remove connected ink blobs smaller than minSize pixels. */
function removeSpecks(ink: Float32Array, w: number, h: number, minSize: number) {
  if (minSize < 2) return;
  const N = w * h;
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  const blob: number[] = [];
  for (let s = 0; s < N; s++) {
    if (seen[s] || ink[s] < 0.35) continue;
    blob.length = 0;
    let sp = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp) {
      const p = stack[--sp];
      blob.push(p);
      const x = p % w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of nb) {
        if (q < 0 || q >= N || seen[q] || ink[q] < 0.35) continue;
        seen[q] = 1;
        stack[sp++] = q;
      }
      if (blob.length > minSize) {
        // big enough — finish marking it without recording
        while (sp) {
          const p2 = stack[--sp];
          const x2 = p2 % w;
          const nb2 = [x2 > 0 ? p2 - 1 : -1, x2 < w - 1 ? p2 + 1 : -1, p2 - w, p2 + w];
          for (const q of nb2) {
            if (q < 0 || q >= N || seen[q] || ink[q] < 0.35) continue;
            seen[q] = 1;
            stack[sp++] = q;
          }
        }
        break;
      }
    }
    if (blob.length <= minSize) for (const p of blob) ink[p] = 0;
  }
}

export interface Analysis {
  looksLikeDrawing: boolean;
  /** fraction of pixels that are near-white or near-black */
  bimodal: number;
}

/** Decide whether a picture is already line art or a photo. */
export function analyzeImage(data: ImageData): Analysis {
  const g = toGray(data);
  let extremes = 0;
  let mid = 0;
  const step = Math.max(1, Math.floor(g.length / 200000));
  let n = 0;
  for (let i = 0; i < g.length; i += step) {
    const v = g[i];
    if (v > 215 || v < 70) extremes++;
    else mid++;
    n++;
  }
  const bimodal = extremes / Math.max(1, n);
  return { looksLikeDrawing: bimodal > 0.86 && mid / n < 0.14, bimodal };
}

/**
 * Turn an RGBA image into ink (black with alpha). Returns ImageData of the
 * same size.
 */
export function convertToLineArt(src: ImageData, s: ConvertSettings): ImageData {
  const w = src.width;
  const h = src.height;
  const N = w * h;
  const scale = Math.max(w, h) / 1000;
  let g = toGray(src);
  applyContrast(g, s.contrast);
  let ink = new Float32Array(N);

  if (s.mode === 'asis') {
    for (let i = 0; i < N; i++) ink[i] = (255 - g[i]) / 255;
  } else if (s.mode === 'drawing') {
    // soft threshold on darkness — keeps anti-aliasing smooth
    const T = 40 + (100 - s.sensitivity) * 1.8; // 40..220
    const soft = 28;
    for (let i = 0; i < N; i++) {
      const d = 255 - g[i];
      ink[i] = Math.max(0, Math.min(1, (d - (T - soft)) / (soft * 2)));
    }
  } else {
    // photo: blur, Sobel edges, plus dark-region outlines
    const br = Math.max(1, Math.round(1.2 * scale));
    g = boxBlur(boxBlur(g, w, h, br), w, h, br);
    const mag = new Float32Array(N);
    let max = 1;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx =
          -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
        const gy =
          -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
        const m = Math.sqrt(gx * gx + gy * gy);
        mag[i] = m;
        if (m > max) max = m;
      }
    }
    // pick threshold from a percentile so it adapts to each photo
    const hist = new Uint32Array(256);
    for (let i = 0; i < N; i++) hist[Math.min(255, ((mag[i] / max) * 255) | 0)]++;
    const keep = 0.04 + (s.sensitivity / 100) * 0.16; // keep top 4%..20% as edges
    let acc = 0;
    let t = 255;
    for (; t > 0; t--) {
      acc += hist[t];
      if (acc / N >= keep) break;
    }
    // never treat very gentle changes (sky gradients, JPEG banding) as lines
    const floor = 20 + (100 - s.sensitivity) * 0.7;
    const thr = Math.max(floor, (t / 255) * max);
    for (let i = 0; i < N; i++) {
      const v = mag[i] / Math.max(1, thr);
      ink[i] = Math.max(0, Math.min(1, (v - 0.6) * 4));
    }
  }

  const thick = Math.round(s.thickness * Math.max(1, scale));
  if (thick > 0) ink = dilateInk(ink, w, h, thick);
  const minSpeck = Math.round((s.cleanup / 100) * 120 * scale * scale);
  removeSpecks(ink, w, h, minSpeck);

  const out = new ImageData(w, h);
  const o = out.data;
  for (let i = 0; i < N; i++) o[i * 4 + 3] = Math.round(ink[i] * 255);
  return out;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, quality);
  });
}

export async function blobToCanvas(b: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(b);
  try {
    const img = await loadImage(url);
    const c = createCanvas(img.naturalWidth, img.naturalHeight);
    ctx2d(c).drawImage(img, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
