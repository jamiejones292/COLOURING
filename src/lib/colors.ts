export interface Swatch {
  name: string;
  hex: string;
}

/** 48 bright, kid-friendly colours, arranged roughly as a rainbow. */
export const PALETTE: Swatch[] = [
  { name: 'Cherry red', hex: '#e62e3d' },
  { name: 'Tomato', hex: '#ff5a4e' },
  { name: 'Coral', hex: '#ff7f6b' },
  { name: 'Salmon pink', hex: '#ffa494' },
  { name: 'Orange', hex: '#ff8a1e' },
  { name: 'Tangerine', hex: '#ffa63d' },
  { name: 'Apricot', hex: '#ffc07a' },
  { name: 'Peach', hex: '#ffd9b3' },
  { name: 'Sunflower', hex: '#ffcc00' },
  { name: 'Lemon', hex: '#ffe74c' },
  { name: 'Banana', hex: '#fff38a' },
  { name: 'Butter', hex: '#fff8c4' },
  { name: 'Lime', hex: '#a6e22e' },
  { name: 'Apple green', hex: '#5fcf3a' },
  { name: 'Grass green', hex: '#2fae4a' },
  { name: 'Forest green', hex: '#1d7a3c' },
  { name: 'Mint', hex: '#8ef0c4' },
  { name: 'Sea green', hex: '#2ac9a0' },
  { name: 'Teal', hex: '#11a3a3' },
  { name: 'Pine', hex: '#0f6b6b' },
  { name: 'Sky blue', hex: '#7fd4ff' },
  { name: 'Ocean blue', hex: '#2fa8f5' },
  { name: 'Royal blue', hex: '#2f63e6' },
  { name: 'Navy', hex: '#1f2f80' },
  { name: 'Lavender', hex: '#c9b5ff' },
  { name: 'Violet', hex: '#9b6bff' },
  { name: 'Purple', hex: '#7a3fd6' },
  { name: 'Plum', hex: '#5a2389' },
  { name: 'Bubblegum', hex: '#ffb3d9' },
  { name: 'Pink', hex: '#ff73b9' },
  { name: 'Hot pink', hex: '#ff2e93' },
  { name: 'Raspberry', hex: '#c21868' },
  { name: 'Light tan', hex: '#f5d6b4' },
  { name: 'Caramel', hex: '#d9a066' },
  { name: 'Cinnamon', hex: '#b5733d' },
  { name: 'Chocolate', hex: '#7a4a24' },
  { name: 'Skin light', hex: '#ffe0c7' },
  { name: 'Skin medium', hex: '#e8b48a' },
  { name: 'Skin tan', hex: '#c68a5a' },
  { name: 'Skin deep', hex: '#8a5532' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Cloud grey', hex: '#dfe3ea' },
  { name: 'Silver', hex: '#aeb6c2' },
  { name: 'Stone grey', hex: '#77808f' },
  { name: 'Charcoal', hex: '#3f4552' },
  { name: 'Black', hex: '#1a1a22' },
  { name: 'Gold', hex: '#e8b923' },
  { name: 'Copper', hex: '#c8743a' },
];

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** h: 0-360, s/l: 0-100 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function randomFunColor(): string {
  return hslToHex(Math.random() * 360, 75 + Math.random() * 20, 50 + Math.random() * 15);
}

/** Is this colour light (so a dark tick mark should be used on it)? */
export function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
