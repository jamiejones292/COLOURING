export function PaintpotIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#7c5cff" />
      <path d="M14 40c0-12 8-24 18-24s18 12 18 24c0 5-4 8-9 8H23c-5 0-9-3-9-8z" fill="#fff" />
      <circle cx="24" cy="34" r="5" fill="#ff4797" />
      <circle cx="33" cy="27" r="5" fill="#ffd23f" />
      <circle cx="42" cy="34" r="5" fill="#1ea7f5" />
      <circle cx="33" cy="40" r="4" fill="#1fc995" />
    </svg>
  );
}

const LETTERS = ['#ff4797', '#ff7a1a', '#ffbf1f', '#1fc995', '#1ea7f5', '#7c5cff'];

export function Logo({ big = false }: { big?: boolean }) {
  const word = (w: string, offset: number) =>
    w.split('').map((ch, i) => (
      <span key={i} style={{ color: LETTERS[(i + offset) % LETTERS.length] }} className="inline-block drop-shadow-[0_3px_0_rgba(43,35,80,0.15)]">
        {ch}
      </span>
    ));
  return (
    <span className={`inline-flex items-center gap-3 font-display font-bold leading-none ${big ? 'text-5xl sm:text-7xl' : 'text-2xl'}`}>
      <PaintpotIcon size={big ? 72 : 40} />
      <span>
        {word('Paintpot', 0)} <span className="text-ink">Pals</span>
      </span>
    </span>
  );
}
