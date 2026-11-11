import { getPref, setPref } from './prefs';

/** Gentle synthesised sound effects (no audio files needed). */
let ctx: AudioContext | null = null;
let muted = getPref('muted', false);

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  setPref('muted', m);
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sounds = {
  fill: () => tone(420 + Math.random() * 160, 0, 0.18, 'sine', 0.12, 900),
  pop: () => tone(700, 0, 0.12, 'triangle', 0.1, 1200),
  click: () => tone(900, 0, 0.05, 'sine', 0.05),
  undo: () => tone(600, 0, 0.12, 'sine', 0.06, 300),
  tada: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.1));
  },
};
