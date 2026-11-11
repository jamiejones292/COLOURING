/**
 * Region detection — the heart of "stay inside the lines".
 *
 * Input:  an "ink" map (0..255 per pixel, how dark/opaque the outline is).
 * Output: a label for EVERY pixel saying which enclosed area it belongs to.
 *
 * Steps
 *  1. Pixels with ink >= threshold are walls (outlines).
 *  2. Optionally "close gaps": grow the walls by `gap` px so small breaks in an
 *     outline (common in hand drawings / photos) no longer leak.
 *  3. Label the connected non-wall areas (4-connected scanline flood fill).
 *  4. Tiny areas (noise specks, anti-alias crumbs) are dropped.
 *  5. Every unlabelled pixel (walls, grown walls, dropped specks) is handed to
 *     its nearest labelled area with a multi-source BFS. This means a fill
 *     reaches right up to — and underneath — the outline, so there are no
 *     white halos at anti-aliased edges, while the original black outline is
 *     drawn on top and stays crisp.
 */

export interface RegionResult {
  width: number;
  height: number;
  /** label per pixel, 1..count (0 only if the whole image is ink) */
  labels: Int32Array;
  count: number;
  /** [minX, minY, maxX, maxY] per label (index = label * 4) */
  bboxes: Int32Array;
  /** pixel count per label */
  areas: Int32Array;
}

export interface RegionOptions {
  /** ink level (0-255) at/above which a pixel is treated as an outline */
  threshold?: number;
  /** px to grow outlines by before labelling — closes small gaps */
  gap?: number;
  /** areas smaller than this (px) are merged into neighbours */
  minArea?: number;
}

/** Square max-filter (dilation) done separably: O(N * r). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  // horizontal pass using running counts
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let count = 0;
    for (let x = 0; x < Math.min(r, w); x++) count += mask[row + x];
    for (let x = 0; x < w; x++) {
      const add = x + r;
      if (add < w) count += mask[row + add];
      const rem = x - r - 1;
      if (rem >= 0) count -= mask[row + rem];
      tmp[row + x] = count > 0 ? 1 : 0;
    }
  }
  // vertical pass
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(r, h); y++) count += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const add = y + r;
      if (add < h) count += tmp[add * w + x];
      const rem = y - r - 1;
      if (rem >= 0) count -= tmp[rem * w + x];
      out[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

export function computeRegions(ink: Uint8Array | Uint8ClampedArray, width: number, height: number, opts: RegionOptions = {}): RegionResult {
  const w = width;
  const h = height;
  const N = w * h;
  const threshold = opts.threshold ?? 128;
  const gap = Math.max(0, Math.round(opts.gap ?? 0));
  const minArea = opts.minArea ?? Math.max(8, Math.round(N * 0.000006));

  let wall = new Uint8Array(N);
  for (let i = 0; i < N; i++) wall[i] = ink[i] >= threshold ? 1 : 0;
  if (gap > 0) wall = dilate(wall, w, h, gap);

  const labels = new Int32Array(N);
  const stack = new Int32Array(N);
  let next = 0;
  const areaList: number[] = [0];

  // 1) scanline flood fill labelling of open (non-wall) pixels
  for (let start = 0; start < N; start++) {
    if (wall[start] || labels[start]) continue;
    const label = ++next;
    let area = 0;
    let sp = 0;
    stack[sp++] = start;
    while (sp > 0) {
      const p = stack[--sp];
      if (labels[p] || wall[p]) continue;
      const y = (p / w) | 0;
      const row = y * w;
      // walk left
      let lx = p - row;
      while (lx > 0 && !wall[row + lx - 1] && !labels[row + lx - 1]) lx--;
      // walk right, filling and seeding neighbouring rows
      let x = lx;
      let upOpen = false;
      let downOpen = false;
      while (x < w && !wall[row + x] && !labels[row + x]) {
        const i = row + x;
        labels[i] = label;
        area++;
        if (y > 0) {
          const u = i - w;
          const open = !wall[u] && !labels[u];
          if (open && !upOpen) stack[sp++] = u;
          upOpen = open;
        }
        if (y < h - 1) {
          const d = i + w;
          const open = !wall[d] && !labels[d];
          if (open && !downOpen) stack[sp++] = d;
          downOpen = open;
        }
        x++;
      }
    }
    areaList.push(area);
  }

  // 2) drop specks: relabel tiny areas as unassigned
  const remap = new Int32Array(next + 1);
  let count = 0;
  for (let l = 1; l <= next; l++) {
    if (areaList[l] >= minArea) remap[l] = ++count;
  }
  // If everything was tiny (e.g. tiny test image) keep everything
  if (count === 0 && next > 0) {
    for (let l = 1; l <= next; l++) remap[l] = l;
    count = next;
  }
  for (let i = 0; i < N; i++) {
    const l = labels[i];
    if (l) labels[i] = remap[l];
  }

  // 3) multi-source BFS: give unassigned pixels to the nearest area
  if (count > 0) {
    const queue = stack; // reuse buffer
    let head = 0;
    let tail = 0;
    for (let i = 0; i < N; i++) {
      if (!labels[i]) continue;
      const x = i % w;
      if (
        (x > 0 && !labels[i - 1]) ||
        (x < w - 1 && !labels[i + 1]) ||
        (i >= w && !labels[i - w]) ||
        (i < N - w && !labels[i + w])
      ) {
        queue[tail++] = i;
      }
    }
    while (head < tail) {
      const p = queue[head++];
      const l = labels[p];
      const x = p % w;
      if (x > 0 && !labels[p - 1]) { labels[p - 1] = l; queue[tail++] = p - 1; }
      if (x < w - 1 && !labels[p + 1]) { labels[p + 1] = l; queue[tail++] = p + 1; }
      if (p >= w && !labels[p - w]) { labels[p - w] = l; queue[tail++] = p - w; }
      if (p < N - w && !labels[p + w]) { labels[p + w] = l; queue[tail++] = p + w; }
    }
  }

  // 4) bounding boxes + areas
  const bboxes = new Int32Array((count + 1) * 4);
  const areas = new Int32Array(count + 1);
  for (let l = 0; l <= count; l++) {
    bboxes[l * 4] = w;
    bboxes[l * 4 + 1] = h;
    bboxes[l * 4 + 2] = -1;
    bboxes[l * 4 + 3] = -1;
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const l = labels[row + x];
      if (!l) continue;
      areas[l]++;
      const b = l * 4;
      if (x < bboxes[b]) bboxes[b] = x;
      if (y < bboxes[b + 1]) bboxes[b + 1] = y;
      if (x > bboxes[b + 2]) bboxes[b + 2] = x;
      if (y > bboxes[b + 3]) bboxes[b + 3] = y;
    }
  }

  return { width: w, height: h, labels, count, bboxes, areas };
}

/** Extract the alpha channel of an RGBA buffer as an ink map. */
export function alphaToInk(rgba: Uint8ClampedArray): Uint8Array {
  const n = rgba.length / 4;
  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) ink[i] = rgba[i * 4 + 3];
  return ink;
}
