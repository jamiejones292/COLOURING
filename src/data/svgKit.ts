/**
 * Tiny helpers for authoring colouring-page SVGs.
 * Every page is drawn on a 600 x 600 grid with bold, closed outlines.
 * Shapes are filled white so that shapes in front hide the lines behind them.
 */

export const STROKE = '#1b1b1b';

export const svg = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" fill="#fff" stroke="${STROKE}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;

const attrs = (extra = '') => (extra ? ' ' + extra : '');

export const c = (cx: number, cy: number, r: number, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}"${attrs(extra)}/>`;
export const e = (cx: number, cy: number, rx: number, ry: number, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${attrs(extra)}/>`;
export const r = (x: number, y: number, w: number, h: number, rx = 0, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${attrs(extra)}/>`;
export const p = (d: string, extra = '') => `<path d="${d}"${attrs(extra)}/>`;
/** open line (no fill) */
export const l = (d: string, extra = '') => `<path d="${d}" fill="none"${attrs(extra)}/>`;
export const poly = (pts: string, extra = '') => `<polygon points="${pts}"${attrs(extra)}/>`;
export const g = (inner: string, extra = '') => `<g${attrs(extra)}>${inner}</g>`;
/** mirror content across the vertical centre line */
export const mirror = (inner: string) => `<g transform="translate(600,0) scale(-1,1)">${inner}</g>`;
export const black = 'fill="#1b1b1b"';

const f = (n: number) => Math.round(n * 10) / 10;

/** A shiny cartoon eye. */
export const eye = (cx: number, cy: number, rad: number) =>
  c(cx, cy, rad, black) + c(f(cx - rad * 0.32), f(cy - rad * 0.32), f(Math.max(2, rad * 0.3)), 'fill="#fff" stroke="none"');

export function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${f(cx + Math.cos(a) * rad)},${f(cy + Math.sin(a) * rad)}`);
  }
  return pts.join(' ');
}
export const star = (cx: number, cy: number, outer: number, inner?: number, n = 5, extra = '') =>
  poly(starPoints(cx, cy, outer, inner ?? outer * 0.45, n), extra);

/** A circle with bumpy (scalloped) edges — manes, tree tops, frills. */
export function scallopPath(cx: number, cy: number, rad: number, n: number, bulge = 0.62): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([f(cx + Math.cos(a) * rad), f(cy + Math.sin(a) * rad)]);
  }
  const chord = 2 * rad * Math.sin(Math.PI / n);
  const ar = f(chord * bulge);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i <= n; i++) {
    const [x, y] = pts[i % n];
    d += ` A${ar} ${ar} 0 0 1 ${x} ${y}`;
  }
  return d + ' Z';
}
export const scallop = (cx: number, cy: number, rad: number, n: number, extra = '') => p(scallopPath(cx, cy, rad, n), extra);

/** Fluffy cloud with a flat bottom, centred at cx, bottom at cy. */
export function cloud(cx: number, cy: number, w: number, extra = '') {
  const h = w / 2;
  const pts: [number, number][] = [
    [cx - h, cy],
    [cx - h * 0.62, cy - w * 0.2],
    [cx - h * 0.05, cy - w * 0.3],
    [cx + h * 0.5, cy - w * 0.2],
    [cx + h, cy],
  ];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const rr = f(Math.hypot(x1 - x0, y1 - y0) * 0.58);
    d += ` A${rr} ${rr} 0 0 1 ${f(x1)} ${f(y1)}`;
  }
  return p(d + ' Z', extra);
}

export function heart(cx: number, cy: number, s: number, extra = '') {
  return p(
    `M${cx} ${f(cy + s * 0.9)} C${f(cx - s * 1.6)} ${f(cy - s * 0.2)} ${f(cx - s * 0.6)} ${f(cy - s * 1.25)} ${cx} ${f(cy - s * 0.4)} C${f(cx + s * 0.6)} ${f(cy - s * 1.25)} ${f(cx + s * 1.6)} ${f(cy - s * 0.2)} ${cx} ${f(cy + s * 0.9)} Z`,
    extra,
  );
}

/**
 * Draw a shape and pattern lines inside it that end EXACTLY on its edge
 * (using a clip path), so every stripe makes a perfectly closed area.
 */
let clipSeq = 0;
export function clipped(shapeD: string, pattern: string) {
  const id = `k${++clipSeq}`;
  return `<clipPath id="${id}"><path d="${shapeD}"/></clipPath>${p(shapeD)}<g clip-path="url(#${id})">${pattern}</g>${l(shapeD)}`;
}

/** Ellipses arranged around a centre — flower petals. */
export function petals(cx: number, cy: number, n: number, dist: number, rx: number, ry: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += e(cx, cy - dist, rx, ry, `transform="rotate(${f((i * 360) / n)} ${cx} ${cy})"`);
  return s;
}

/** Wavy ground / grass strip from y to the bottom of the page. */
export function ground(y: number, waves = 6, amp = 14) {
  const step = 600 / waves;
  let d = `M0 600 L0 ${y}`;
  for (let i = 0; i < waves; i++) d += ` Q${f(step * i + step / 2)} ${y - amp} ${f(step * (i + 1))} ${y}`;
  return p(d + ' L600 600 Z');
}

/** Simple five-petal flower for decorating scenes. */
export function tinyFlower(cx: number, cy: number, s = 16) {
  return l(`M${cx} ${cy + s} L${cx} ${cy + s * 3.2}`) + petals(cx, cy, 5, s * 0.9, s * 0.55, s * 0.75) + c(cx, cy, s * 0.55);
}

/** Sun with straight rays. */
export function sun(cx: number, cy: number, rad: number, rays = 10) {
  let s = '';
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    s += l(`M${f(cx + Math.cos(a) * (rad + 10))} ${f(cy + Math.sin(a) * (rad + 10))} L${f(cx + Math.cos(a) * (rad + 30))} ${f(cy + Math.sin(a) * (rad + 30))}`);
  }
  return s + c(cx, cy, rad);
}
