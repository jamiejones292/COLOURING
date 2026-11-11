import { History, type HistoryEntry, type LayerName, type Patch } from './history';
import { detectRegions } from './regionClient';
import type { RegionResult } from './regions';
import { createCanvas, ctx2d } from './imageProcessing';
import { hexToRgb, hslToHex } from './colors';

export type Tool = 'fill' | 'brush' | 'rainbow' | 'glitter' | 'eraser' | 'sticker' | 'pan';
export type FillStyle = 'solid' | 'rainbow' | 'glitter';

export interface StrokeOptions {
  tool: 'brush' | 'rainbow' | 'glitter' | 'eraser';
  color: string;
  size: number;
  /** stay inside the region where the stroke started */
  smart: boolean;
  mirror: boolean;
}

interface Mask {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Sparkle {
  x: number;
  y: number;
  r: number;
  color: string;
  star: boolean;
}

interface Pen {
  mask: Mask | null;
  lastX: number;
  lastY: number;
  sparkles: Sparkle[];
  mirrored: boolean;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const emptyRect = (): Rect => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });

function unionRect(r: Rect, x0: number, y0: number, x1: number, y1: number) {
  r.x0 = Math.min(r.x0, x0);
  r.y0 = Math.min(r.y0, y0);
  r.x1 = Math.max(r.x1, x1);
  r.y1 = Math.max(r.y1, y1);
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

/**
 * Imperative colouring engine. Owns three stacked canvases:
 *   colour layer  (paint + fills)
 *   line layer    (black outlines, always on top of colour)
 *   sticker layer (stickers, on top of everything)
 */
export class ColoringEngine {
  width = 0;
  height = 0;
  regions: RegionResult | null = null;
  ready = false;
  gap = 0;
  onChange: () => void = () => {};
  onReady: (ready: boolean) => void = () => {};

  private colorCtx: CanvasRenderingContext2D;
  private lineCtx: CanvasRenderingContext2D;
  private stickerCtx: CanvasRenderingContext2D;
  private ink: Uint8Array | null = null;
  private snapshots: Record<LayerName, ImageData | null> = { color: null, sticker: null };
  private history = new History();
  private scratch: HTMLCanvasElement = createCanvas(1, 1);
  private scratchCtx: CanvasRenderingContext2D;
  private maskCache = new Map<number, Mask>();
  private stroke: { opts: StrokeOptions; pens: Pen[]; dirty: Rect; distance: number } | null = null;
  private regionJob = 0;
  /** increases on every committed change; used for autosave */
  version = 0;

  constructor(
    public colorCanvas: HTMLCanvasElement,
    public lineCanvas: HTMLCanvasElement,
    public stickerCanvas: HTMLCanvasElement,
  ) {
    this.colorCtx = ctx2d(colorCanvas, false);
    this.lineCtx = ctx2d(lineCanvas, false);
    this.stickerCtx = ctx2d(stickerCanvas, false);
    this.scratchCtx = ctx2d(this.scratch, false);
  }

  /** Load a page: `inkCanvas` holds the outlines as black + alpha. */
  async setup(inkCanvas: HTMLCanvasElement, gap: number) {
    const w = inkCanvas.width;
    const h = inkCanvas.height;
    this.width = w;
    this.height = h;
    for (const c of [this.colorCanvas, this.lineCanvas, this.stickerCanvas, this.scratch]) {
      c.width = w;
      c.height = h;
    }
    this.lineCtx.clearRect(0, 0, w, h);
    this.lineCtx.drawImage(inkCanvas, 0, 0);
    const inkData = ctx2d(inkCanvas).getImageData(0, 0, w, h).data;
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < ink.length; i++) ink[i] = inkData[i * 4 + 3];
    this.ink = ink;
    this.colorCtx.clearRect(0, 0, w, h);
    this.stickerCtx.clearRect(0, 0, w, h);
    this.takeSnapshot('color');
    this.takeSnapshot('sticker');
    this.history.clear();
    this.version = 0;
    await this.setGap(gap);
  }

  /** Recompute regions with a different gap-closing setting. */
  async setGap(gap: number) {
    if (!this.ink) return;
    this.gap = gap;
    const job = ++this.regionJob;
    this.ready = false;
    this.onReady(false);
    const r = await detectRegions(this.ink, this.width, this.height, gap);
    if (job !== this.regionJob) return;
    this.regions = r;
    this.maskCache.clear();
    this.ready = true;
    this.onReady(true);
  }

  /** Restore saved layers (drawn as images). */
  loadLayers(color?: CanvasImageSource | null, sticker?: CanvasImageSource | null) {
    if (color) {
      this.colorCtx.clearRect(0, 0, this.width, this.height);
      this.colorCtx.drawImage(color, 0, 0, this.width, this.height);
    }
    if (sticker) {
      this.stickerCtx.clearRect(0, 0, this.width, this.height);
      this.stickerCtx.drawImage(sticker, 0, 0, this.width, this.height);
    }
    this.takeSnapshot('color');
    this.takeSnapshot('sticker');
    this.history.clear();
    this.onChange();
  }

  private ctxFor(layer: LayerName) {
    return layer === 'color' ? this.colorCtx : this.stickerCtx;
  }

  private takeSnapshot(layer: LayerName) {
    this.snapshots[layer] = this.ctxFor(layer).getImageData(0, 0, this.width, this.height);
  }

  /** Copy a rectangle out of the in-memory snapshot of a layer. */
  private cropSnapshot(layer: LayerName, x: number, y: number, w: number, h: number): ImageData {
    const snap = this.snapshots[layer]!;
    const out = new ImageData(w, h);
    const W = this.width;
    for (let row = 0; row < h; row++) {
      const s = ((y + row) * W + x) * 4;
      out.data.set(snap.data.subarray(s, s + w * 4), row * w * 4);
    }
    return out;
  }

  private writeSnapshot(layer: LayerName, x: number, y: number, img: ImageData) {
    const snap = this.snapshots[layer]!;
    const W = this.width;
    for (let row = 0; row < img.height; row++) {
      snap.data.set(img.data.subarray(row * img.width * 4, (row + 1) * img.width * 4), ((y + row) * W + x) * 4);
    }
  }

  private commit(entry: HistoryEntry) {
    if (!entry.patches.length) return;
    this.history.push(entry);
    this.version++;
    this.onChange();
  }

  get canUndo() {
    return this.history.canUndo;
  }
  get canRedo() {
    return this.history.canRedo;
  }

  private applyPatches(patches: Patch[], which: 'before' | 'after') {
    for (const p of patches) {
      const img = p[which];
      this.ctxFor(p.layer).putImageData(img, p.x, p.y);
      this.writeSnapshot(p.layer, p.x, p.y, img);
    }
  }

  undo() {
    if (this.stroke) this.cancelStroke();
    const e = this.history.undo();
    if (!e) return false;
    this.applyPatches([...e.patches].reverse(), 'before');
    this.version++;
    this.onChange();
    return true;
  }

  redo() {
    const e = this.history.redo();
    if (!e) return false;
    this.applyPatches(e.patches, 'after');
    this.version++;
    this.onChange();
    return true;
  }

  // ------------------------------------------------------------------ regions

  labelAt(x: number, y: number): number {
    if (!this.regions) return 0;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return 0;
    return this.regions.labels[yi * this.width + xi];
  }

  private regionBox(label: number) {
    const b = this.regions!.bboxes;
    const x = b[label * 4];
    const y = b[label * 4 + 1];
    return { x, y, w: b[label * 4 + 2] - x + 1, h: b[label * 4 + 3] - y + 1 };
  }

  private getMask(label: number): Mask | null {
    if (!this.regions || !label) return null;
    const cached = this.maskCache.get(label);
    if (cached) return cached;
    const { x, y, w, h } = this.regionBox(label);
    const canvas = createCanvas(w, h);
    const img = new ImageData(w, h);
    const labels = this.regions.labels;
    const W = this.width;
    for (let row = 0; row < h; row++) {
      const base = (y + row) * W + x;
      for (let col = 0; col < w; col++) {
        if (labels[base + col] === label) img.data[(row * w + col) * 4 + 3] = 255;
      }
    }
    ctx2d(canvas, false).putImageData(img, 0, 0);
    const mask = { canvas, x, y, w, h };
    if (this.maskCache.size > 24) {
      const first = this.maskCache.keys().next().value;
      if (first !== undefined) this.maskCache.delete(first);
    }
    this.maskCache.set(label, mask);
    return mask;
  }

  // --------------------------------------------------------------- magic fill

  /** Fill the enclosed area under (x, y). Returns true if anything changed. */
  fill(x: number, y: number, color: string, style: FillStyle = 'solid', mirror = false): boolean {
    if (!this.ready || !this.regions) return false;
    const targets = new Set<number>();
    const l = this.labelAt(x, y);
    if (l) targets.add(l);
    if (mirror) {
      const m = this.labelAt(this.width - 1 - x, y);
      if (m) targets.add(m);
    }
    const patches: Patch[] = [];
    for (const label of targets) {
      const p = this.fillLabel(label, color, style);
      if (p) patches.push(p);
    }
    this.commit({ patches });
    return patches.length > 0;
  }

  private fillLabel(label: number, color: string, style: FillStyle): Patch | null {
    const { x, y, w, h } = this.regionBox(label);
    if (w <= 0 || h <= 0) return null;
    const before = this.cropSnapshot('color', x, y, w, h);
    const after = new ImageData(new Uint8ClampedArray(before.data), w, h);
    const labels = this.regions!.labels;
    const W = this.width;
    let changed = false;

    if (style === 'solid') {
      const [r, g, b] = hexToRgb(color);
      const d = after.data;
      for (let row = 0; row < h; row++) {
        const base = (y + row) * W + x;
        for (let col = 0; col < w; col++) {
          if (labels[base + col] !== label) continue;
          const i = (row * w + col) * 4;
          if (d[i] !== r || d[i + 1] !== g || d[i + 2] !== b || d[i + 3] !== 255) changed = true;
          d[i] = r;
          d[i + 1] = g;
          d[i + 2] = b;
          d[i + 3] = 255;
        }
      }
    } else {
      const src = this.renderFillSource(w, h, color, style);
      const s = src.data;
      const d = after.data;
      for (let row = 0; row < h; row++) {
        const base = (y + row) * W + x;
        for (let col = 0; col < w; col++) {
          if (labels[base + col] !== label) continue;
          const i = (row * w + col) * 4;
          d[i] = s[i];
          d[i + 1] = s[i + 1];
          d[i + 2] = s[i + 2];
          d[i + 3] = 255;
          changed = true;
        }
      }
    }
    if (!changed) return null;
    this.colorCtx.putImageData(after, x, y);
    this.writeSnapshot('color', x, y, after);
    return { layer: 'color', x, y, before, after };
  }

  private renderFillSource(w: number, h: number, color: string, style: FillStyle): ImageData {
    const c = createCanvas(w, h);
    const ctx = ctx2d(c);
    if (style === 'rainbow') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      const n = 7;
      for (let i = 0; i <= n; i++) g.addColorStop(i / n, hslToHex((i / n) * 330, 90, 62));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      const count = Math.min(4000, Math.round((w * h) / 260));
      for (let i = 0; i < count; i++) {
        const sx = Math.random() * w;
        const sy = Math.random() * h;
        const r = 0.8 + Math.random() * 2.4;
        this.drawSparkle(ctx, { x: sx, y: sy, r, color: Math.random() < 0.5 ? '#ffffff' : sparkleTint(color), star: Math.random() < 0.18 });
      }
    }
    return ctx.getImageData(0, 0, w, h);
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, s: Sparkle) {
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.95;
    if (s.star) {
      const r = s.r * 2.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r);
      ctx.quadraticCurveTo(s.x, s.y, s.x - r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ strokes

  get isStroking() {
    return this.stroke !== null;
  }

  beginStroke(x: number, y: number, opts: StrokeOptions) {
    if (this.stroke) this.endStroke();
    const smart = opts.smart && this.ready;
    const mkPen = (px: number, mirrored: boolean): Pen => ({
      mask: smart ? this.getMask(this.labelAt(px, y)) : null,
      lastX: px,
      lastY: y,
      sparkles: [],
      mirrored,
    });
    const pens = [mkPen(x, false)];
    if (opts.mirror) pens.push(mkPen(this.width - 1 - x, true));
    this.stroke = { opts, pens, dirty: emptyRect(), distance: 0 };
    // a dot for taps
    this.strokeTo(x, y, true);
  }

  moveStroke(x: number, y: number) {
    if (!this.stroke) return;
    this.strokeTo(x, y, false);
  }

  private strokeTo(x: number, y: number, first: boolean) {
    const st = this.stroke!;
    const { opts } = st;
    const size = opts.size;
    const pen0 = st.pens[0];
    const dist = Math.hypot(x - pen0.lastX, y - pen0.lastY);
    if (!first && dist < 0.5) return;
    st.distance += dist;

    let color = opts.color;
    if (opts.tool === 'rainbow') color = hslToHex((st.distance * 0.6) % 360, 92, 58);

    for (const pen of st.pens) {
      const tx = pen.mirrored ? this.width - 1 - x : x;
      const fx = first ? tx : pen.lastX;
      const fy = first ? y : pen.lastY;
      const pad = size / 2 + 6;
      const r: Rect = {
        x0: Math.min(fx, tx) - pad,
        y0: Math.min(fy, y) - pad,
        x1: Math.max(fx, tx) + pad,
        y1: Math.max(fy, y) + pad,
      };

      // glitter: sparkles placed earlier are drawn once the brush moved on,
      // so the next segment's paint doesn't cover them
      let ready: Sparkle[] = [];
      if (opts.tool === 'glitter') {
        const keep: Sparkle[] = [];
        for (const s of pen.sparkles) {
          if (Math.hypot(s.x - tx, s.y - y) > size * 0.55 + s.r * 3) ready.push(s);
          else keep.push(s);
        }
        pen.sparkles = keep;
        const n = Math.max(1, Math.round((dist / Math.max(2, size)) * 3.2)) + (first ? 2 : 0);
        for (let i = 0; i < n; i++) {
          const t = Math.random();
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * size * 0.45;
          pen.sparkles.push({
            x: fx + (tx - fx) * t + Math.cos(ang) * rad,
            y: fy + (y - fy) * t + Math.sin(ang) * rad,
            r: Math.max(0.8, size * (0.04 + Math.random() * 0.06)),
            color: Math.random() < 0.55 ? '#ffffff' : sparkleTint(opts.color),
            star: Math.random() < 0.22,
          });
        }
        for (const s of ready) unionRect(r, s.x - s.r * 3, s.y - s.r * 3, s.x + s.r * 3, s.y + s.r * 3);
      }

      this.paintSegment(pen, r, (ctx) => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size;
        ctx.strokeStyle = opts.tool === 'eraser' ? '#000' : color;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx + (first ? 0.01 : 0), y);
        ctx.stroke();
        for (const s of ready) this.drawSparkle(ctx, s);
      });
      pen.lastX = tx;
      pen.lastY = y;
    }
  }

  /** Draw something into scratch, mask it to the pen's region, composite. */
  private paintSegment(pen: Pen, r: Rect, draw: (ctx: CanvasRenderingContext2D) => void) {
    const st = this.stroke!;
    const x0 = Math.max(0, Math.floor(r.x0));
    const y0 = Math.max(0, Math.floor(r.y0));
    const x1 = Math.min(this.width, Math.ceil(r.x1));
    const y1 = Math.min(this.height, Math.ceil(r.y1));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const sc = this.scratchCtx;
    sc.save();
    sc.beginPath();
    sc.rect(x0, y0, w, h);
    sc.clip();
    sc.clearRect(x0, y0, w, h);
    draw(sc);
    if (pen.mask) {
      const m = pen.mask;
      sc.globalCompositeOperation = 'destination-in';
      sc.drawImage(m.canvas, m.x, m.y);
      sc.globalCompositeOperation = 'source-over';
      // be explicit about everything outside the mask's box
      if (m.x > x0) sc.clearRect(x0, y0, m.x - x0, h);
      if (m.x + m.w < x1) sc.clearRect(m.x + m.w, y0, x1 - (m.x + m.w), h);
      if (m.y > y0) sc.clearRect(x0, y0, w, m.y - y0);
      if (m.y + m.h < y1) sc.clearRect(x0, m.y + m.h, w, y1 - (m.y + m.h));
    }
    sc.restore();

    const layers: CanvasRenderingContext2D[] = st.opts.tool === 'eraser' ? [this.colorCtx, this.stickerCtx] : [this.colorCtx];
    for (const ctx of layers) {
      ctx.save();
      ctx.globalCompositeOperation = st.opts.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.drawImage(this.scratch, x0, y0, w, h, x0, y0, w, h);
      ctx.restore();
    }
    unionRect(st.dirty, x0, y0, x1, y1);
  }

  endStroke() {
    const st = this.stroke;
    if (!st) return;
    // flush remaining glitter sparkles
    if (st.opts.tool === 'glitter') {
      for (const pen of st.pens) {
        if (!pen.sparkles.length) continue;
        const r = emptyRect();
        for (const s of pen.sparkles) unionRect(r, s.x - s.r * 3, s.y - s.r * 3, s.x + s.r * 3, s.y + s.r * 3);
        const list = pen.sparkles;
        pen.sparkles = [];
        this.paintSegment(pen, r, (ctx) => list.forEach((s) => this.drawSparkle(ctx, s)));
      }
    }
    this.stroke = null;
    const d = st.dirty;
    if (d.x1 <= d.x0 || d.y1 <= d.y0) return;
    const x = Math.max(0, d.x0);
    const y = Math.max(0, d.y0);
    const w = Math.min(this.width, d.x1) - x;
    const h = Math.min(this.height, d.y1) - y;
    const layers: LayerName[] = st.opts.tool === 'eraser' ? ['color', 'sticker'] : ['color'];
    const patches: Patch[] = [];
    for (const layer of layers) {
      const before = this.cropSnapshot(layer, x, y, w, h);
      const after = this.ctxFor(layer).getImageData(x, y, w, h);
      if (sameData(before.data, after.data)) continue;
      this.writeSnapshot(layer, x, y, after);
      patches.push({ layer, x, y, before, after });
    }
    this.commit({ patches });
  }

  /** Abort the current stroke (e.g. a second finger arrived for pinch-zoom). */
  cancelStroke() {
    const st = this.stroke;
    if (!st) return;
    this.stroke = null;
    const d = st.dirty;
    if (d.x1 <= d.x0) return;
    const x = Math.max(0, d.x0);
    const y = Math.max(0, d.y0);
    const w = Math.min(this.width, d.x1) - x;
    const h = Math.min(this.height, d.y1) - y;
    for (const layer of ['color', 'sticker'] as LayerName[]) {
      this.ctxFor(layer).putImageData(this.cropSnapshot(layer, x, y, w, h), x, y);
    }
  }

  // ----------------------------------------------------------------- stickers

  stamp(x: number, y: number, emoji: string, size: number, mirror = false) {
    const pts: [number, number][] = [[x, y]];
    if (mirror) pts.push([this.width - 1 - x, y]);
    const ctx = this.stickerCtx;
    const rect = emptyRect();
    for (const [px, py] of pts) {
      const rot = (Math.random() - 0.5) * 0.5;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, size * 0.05);
      ctx.restore();
      unionRect(rect, px - size, py - size, px + size, py + size);
    }
    const x0 = Math.max(0, Math.floor(rect.x0));
    const y0 = Math.max(0, Math.floor(rect.y0));
    const w = Math.min(this.width, Math.ceil(rect.x1)) - x0;
    const h = Math.min(this.height, Math.ceil(rect.y1)) - y0;
    if (w <= 0 || h <= 0) return;
    const before = this.cropSnapshot('sticker', x0, y0, w, h);
    const after = ctx.getImageData(x0, y0, w, h);
    this.writeSnapshot('sticker', x0, y0, after);
    this.commit({ patches: [{ layer: 'sticker', x: x0, y: y0, before, after }] });
  }

  // -------------------------------------------------------------------- misc

  /** Clear all colour and stickers (undoable). */
  reset() {
    const patches: Patch[] = [];
    for (const layer of ['color', 'sticker'] as LayerName[]) {
      const before = this.cropSnapshot(layer, 0, 0, this.width, this.height);
      const after = new ImageData(this.width, this.height);
      if (sameData(before.data, after.data)) continue;
      this.ctxFor(layer).clearRect(0, 0, this.width, this.height);
      this.writeSnapshot(layer, 0, 0, after);
      patches.push({ layer, x: 0, y: 0, before, after });
    }
    this.commit({ patches });
  }

  isBlank(): boolean {
    for (const layer of ['color', 'sticker'] as LayerName[]) {
      const d = this.snapshots[layer]?.data;
      if (!d) continue;
      for (let i = 3; i < d.length; i += 16) if (d[i]) return false;
    }
    return true;
  }

  /** Proportion of non-background regions that have some colour (0..1). */
  coverage(): number {
    const r = this.regions;
    const snap = this.snapshots.color;
    if (!r || !snap) return 0;
    const colored = new Uint8Array(r.count + 1);
    const labels = r.labels;
    for (let i = 0; i < labels.length; i += 7) if (snap.data[i * 4 + 3] > 0) colored[labels[i]] = 1;
    let total = 0;
    let done = 0;
    for (let l = 1; l <= r.count; l++) {
      if (r.areas[l] < 200) continue;
      total++;
      done += colored[l];
    }
    return total ? done / total : 0;
  }

  /**
   * Flatten everything into one image. `lineOverride` can supply a crisper,
   * higher-resolution outline layer for exports.
   */
  composite(scale = 1, lineOverride?: CanvasImageSource, background = '#ffffff'): HTMLCanvasElement {
    const w = Math.round(this.width * scale);
    const h = Math.round(this.height * scale);
    const c = createCanvas(w, h);
    const ctx = ctx2d(c, false);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(this.colorCanvas, 0, 0, w, h);
    ctx.drawImage(lineOverride ?? this.lineCanvas, 0, 0, w, h);
    ctx.drawImage(this.stickerCanvas, 0, 0, w, h);
    return c;
  }

  /** Small canvas preview for galleries. */
  thumbnail(maxSide = 360): HTMLCanvasElement {
    const s = maxSide / Math.max(this.width, this.height);
    return this.composite(s);
  }
}

function sameData(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sparkleTint(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (v: number) => Math.round(v + (255 - v) * 0.6);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
