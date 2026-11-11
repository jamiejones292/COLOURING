import { useEffect, useRef } from 'react';

const COLORS = ['#ff4797', '#ffd23f', '#1ea7f5', '#1fc995', '#7c5cff', '#ff7a1a'];

/** Lightweight canvas confetti burst. */
export function Confetti({ run }: { run: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!run) return;
    const c = ref.current;
    if (!c) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const n = reduce ? 40 : 180;
    const parts = Array.from({ length: n }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 6,
      s: 6 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      shape: Math.random() < 0.3 ? 'star' : Math.random() < 0.5 ? 'circle' : 'rect',
    }));
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.38;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? p.s * 0.35 : p.s * 0.8;
            const a = (i * Math.PI) / 5;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.fill();
        } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t - start < 4000) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" aria-hidden="true" />;
}
