import { describe, it, expect } from 'vitest';
import { computeRegions, dilate } from '../src/lib/regions';
import { History } from '../src/lib/history';
import { hexToRgb, hslToHex, rgbToHex } from '../src/lib/colors';

/** Build an ink map: draw rectangles outlines of given thickness */
function canvas(w: number, h: number) {
  const ink = new Uint8Array(w * h);
  const rect = (x0: number, y0: number, x1: number, y1: number, t = 2, v = 255) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (x - x0 < t || x1 - x < t || y - y0 < t || y1 - y < t) ink[y * w + x] = v;
  };
  const line = (x0: number, y0: number, x1: number, y1: number, v = 255) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ink[y * w + x] = v;
  };
  return { ink, rect, line };
}

describe('computeRegions', () => {
  it('separates the inside and outside of a closed shape', () => {
    const { ink, rect } = canvas(100, 100);
    rect(20, 20, 79, 79, 3);
    const r = computeRegions(ink, 100, 100);
    expect(r.count).toBe(2);
    const inside = r.labels[50 * 100 + 50];
    const outside = r.labels[5 * 100 + 5];
    expect(inside).not.toBe(outside);
  });

  it('assigns every pixel (including outline pixels) to a region — no halos', () => {
    const { ink, rect } = canvas(80, 80);
    rect(10, 10, 69, 69, 4);
    const r = computeRegions(ink, 80, 80);
    for (let i = 0; i < r.labels.length; i++) expect(r.labels[i]).toBeGreaterThan(0);
    // pixel just inside the outline belongs to the inner region
    expect(r.labels[40 * 80 + 14]).toBe(r.labels[40 * 80 + 40]);
    expect(r.labels[40 * 80 + 9]).toBe(r.labels[2 * 80 + 2]);
  });

  it('a gap in the outline leaks without leak guard, and is sealed with it', () => {
    const { ink, rect } = canvas(120, 120);
    rect(20, 20, 99, 99, 3);
    // knock a 4px hole in the left wall
    for (let y = 58; y < 62; y++) for (let x = 20; x < 23; x++) ink[y * 120 + x] = 0;
    const leaky = computeRegions(ink, 120, 120, { gap: 0 });
    expect(leaky.labels[60 * 120 + 60]).toBe(leaky.labels[5 * 120 + 5]);
    const sealed = computeRegions(ink, 120, 120, { gap: 3 });
    expect(sealed.labels[60 * 120 + 60]).not.toBe(sealed.labels[5 * 120 + 5]);
  });

  it('keeps small enclosed spaces separate', () => {
    const { ink, rect } = canvas(100, 100);
    rect(10, 10, 89, 89, 2);
    rect(40, 40, 52, 52, 2); // tiny 9x9 interior
    const r = computeRegions(ink, 100, 100, { minArea: 8 });
    const tiny = r.labels[46 * 100 + 46];
    const big = r.labels[25 * 100 + 25];
    expect(tiny).not.toBe(big);
  });

  it('treats faint anti-aliased pixels below the threshold as paintable', () => {
    const { ink, line } = canvas(60, 60);
    line(29, 0, 30, 59, 255);
    line(28, 0, 28, 59, 60); // faint AA fringe
    line(31, 0, 31, 59, 60);
    const r = computeRegions(ink, 60, 60);
    expect(r.count).toBe(2);
    expect(r.labels[10 * 60 + 28]).toBe(r.labels[10 * 60 + 5]);
    expect(r.labels[10 * 60 + 31]).toBe(r.labels[10 * 60 + 55]);
  });

  it('merges noise specks into neighbouring areas', () => {
    const { ink, rect } = canvas(100, 100);
    rect(30, 30, 34, 34, 2); // 1x1 interior speck
    const r = computeRegions(ink, 100, 100, { minArea: 8 });
    expect(r.count).toBe(1);
  });

  it('computes bounding boxes', () => {
    const { ink, rect } = canvas(100, 100);
    rect(20, 30, 59, 79, 2);
    const r = computeRegions(ink, 100, 100);
    const l = r.labels[50 * 100 + 40];
    const [x0, y0, x1, y1] = Array.from(r.bboxes.slice(l * 4, l * 4 + 4));
    expect(x0).toBeGreaterThanOrEqual(20);
    expect(y0).toBeGreaterThanOrEqual(30);
    expect(x1).toBeLessThanOrEqual(59);
    expect(y1).toBeLessThanOrEqual(79);
  });
});

describe('dilate', () => {
  it('grows a single pixel into a square', () => {
    const m = new Uint8Array(25);
    m[12] = 1;
    const d = dilate(m, 5, 5, 1);
    expect(Array.from(d).reduce((a, b) => a + b, 0)).toBe(9);
  });
});

describe('History', () => {
  it('undoes and redoes in order and clears redo on new action', () => {
    const h = new History();
    const fake = (n: number) => ({ patches: [{ layer: 'color' as const, x: n, y: 0, before: { data: new Uint8ClampedArray(4) } as ImageData, after: { data: new Uint8ClampedArray(4) } as ImageData }] });
    h.push(fake(1));
    h.push(fake(2));
    expect(h.undo()?.patches[0].x).toBe(2);
    expect(h.canRedo).toBe(true);
    expect(h.redo()?.patches[0].x).toBe(2);
    h.undo();
    h.push(fake(3));
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.patches[0].x).toBe(3);
    expect(h.undo()?.patches[0].x).toBe(1);
    expect(h.canUndo).toBe(false);
  });
});

describe('colours', () => {
  it('round-trips hex', () => {
    expect(rgbToHex(...hexToRgb('#ff4797'))).toBe('#ff4797');
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
  });
});
