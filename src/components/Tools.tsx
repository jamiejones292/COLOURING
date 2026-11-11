import type { ReactNode } from 'react';
import { Brush, Eraser, Hand, PaintBucket, Sparkles, Sticker, Rainbow, Dices, Pipette, Check } from 'lucide-react';
import type { FillStyle, Tool } from '../lib/engine';
import { PALETTE, hslToHex, isLight, randomFunColor } from '../lib/colors';

export const TOOLS: { id: Tool; label: string; icon: ReactNode; color: string }[] = [
  { id: 'fill', label: 'Magic Fill', icon: <PaintBucket size={26} />, color: '#7c5cff' },
  { id: 'brush', label: 'Paintbrush', icon: <Brush size={26} />, color: '#ff4797' },
  { id: 'rainbow', label: 'Rainbow Brush', icon: <Rainbow size={26} />, color: '#ff7a1a' },
  { id: 'glitter', label: 'Glitter Brush', icon: <Sparkles size={26} />, color: '#e8b923' },
  { id: 'eraser', label: 'Eraser', icon: <Eraser size={26} />, color: '#1ea7f5' },
  { id: 'sticker', label: 'Stickers', icon: <Sticker size={26} />, color: '#1fc995' },
  { id: 'pan', label: 'Move', icon: <Hand size={26} />, color: '#77808f' },
];

export function ToolButton({ tool, active, onClick, compact }: { tool: (typeof TOOLS)[number]; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={tool.label}
      title={tool.label}
      className={`btn relative shrink-0 flex-col gap-0.5 rounded-2xl ${compact ? 'h-[52px] w-[52px]' : 'h-[68px] w-[68px]'} ${
        active ? 'scale-105 text-white shadow-pop' : 'bg-white text-ink shadow-pop-sm hover:bg-grape-50'
      }`}
      style={active ? { background: tool.color } : undefined}
    >
      {tool.icon}
      <span className={`text-[10px] font-semibold leading-none ${compact ? 'hidden' : ''}`}>{tool.label.split(' ')[0]}</span>
    </button>
  );
}

export function Swatch({ hex, name, active, onPick, size = 40 }: { hex: string; name: string; active: boolean; onPick: (hex: string) => void; size?: number }) {
  return (
    <button
      onClick={() => onPick(hex)}
      aria-label={name}
      aria-pressed={active}
      title={name}
      className={`relative shrink-0 rounded-full border-[3px] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-grape-400/60 ${
        active ? 'scale-110 border-ink shadow-pop-sm' : 'border-white shadow-[0_2px_0_rgba(43,35,80,0.15)] hover:scale-105'
      }`}
      style={{ background: hex, width: size, height: size }}
    >
      {active && <Check size={size * 0.5} className={`absolute inset-0 m-auto ${isLight(hex) ? 'text-ink' : 'text-white'}`} strokeWidth={4} />}
    </button>
  );
}

export function PaletteGrid({ color, onPick, layout }: { color: string; onPick: (hex: string) => void; layout: 'grid' | 'strip' }) {
  if (layout === 'strip') {
    return (
      <div className="no-scrollbar grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-1 py-1">
        {PALETTE.map((s) => (
          <Swatch key={s.hex} {...s} active={s.hex === color} onPick={onPick} size={36} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-6 gap-2">
      {PALETTE.map((s) => (
        <Swatch key={s.hex} {...s} active={s.hex === color} onPick={onPick} size={36} />
      ))}
    </div>
  );
}

/** Rainbow slider + full colour picker + surprise colour. */
export function ColorExtras({ color, onPick, hue, setHue, compact }: { color: string; onPick: (hex: string) => void; hue: number; setHue: (h: number) => void; compact?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${compact ? '' : 'flex-wrap'}`}>
      <div className={`flex items-center gap-2 ${compact ? 'w-36' : 'w-full'}`}>
        <input
          type="range"
          min={0}
          max={359}
          value={hue}
          aria-label="Rainbow colour chooser"
          className="slider hue w-full"
          onChange={(e) => {
            const h = Number(e.target.value);
            setHue(h);
            onPick(hslToHex(h, 90, 55));
          }}
        />
      </div>
      <label className="btn-icon relative h-11 w-11 cursor-pointer overflow-hidden" title="Any colour" aria-label="Choose any colour">
        <Pipette size={20} />
        <input type="color" value={color} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <button className="btn-icon h-11 w-11" onClick={() => onPick(randomFunColor())} title="Surprise colour!" aria-label="Surprise colour">
        <Dices size={22} />
      </button>
      <div className="h-11 w-11 shrink-0 rounded-full border-4 border-white shadow-pop-sm" style={{ background: color }} aria-label="Current colour" role="img" />
    </div>
  );
}

export const BRUSH_SIZES = [0.008, 0.016, 0.028, 0.045, 0.07];

export function SizePicker({ size, setSize, color }: { size: number; setSize: (i: number) => void; color: string }) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Brush size">
      {BRUSH_SIZES.map((_, i) => (
        <button
          key={i}
          role="radio"
          aria-checked={size === i}
          aria-label={`Size ${i + 1}`}
          onClick={() => setSize(i)}
          className={`btn h-11 w-11 shrink-0 rounded-full ${size === i ? 'bg-grape-100 ring-4 ring-grape-400' : 'bg-white shadow-pop-sm'}`}
        >
          <span className="rounded-full" style={{ width: 6 + i * 6, height: 6 + i * 6, background: color === '#ffffff' ? '#ccc' : color }} />
        </button>
      ))}
    </div>
  );
}

export const STICKERS = ['⭐', '🌟', '✨', '❤️', '💖', '😊', '😎', '🥳', '🌈', '🦋', '🌸', '🌻', '🎈', '👑', '🐾', '🍭', '🍦', '🎀', '🐞', '🍓', '🚀', '🦄', '🐶', '🐱', '🌙', '☀️', '⚽', '🎵'];

export function StickerPicker({ sticker, setSticker, layout }: { sticker: string; setSticker: (s: string) => void; layout: 'grid' | 'strip' }) {
  return (
    <div className={layout === 'grid' ? 'grid grid-cols-5 gap-2' : 'no-scrollbar grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-1 py-1'}>
      {STICKERS.map((s) => (
        <button
          key={s}
          onClick={() => setSticker(s)}
          aria-pressed={sticker === s}
          aria-label={`Sticker ${s}`}
          className={`btn h-11 w-11 shrink-0 text-2xl ${sticker === s ? 'scale-110 bg-mint-300 ring-4 ring-mint-500' : 'bg-white shadow-pop-sm'}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function FillStylePicker({ style, setStyle }: { style: FillStyle; setStyle: (s: FillStyle) => void }) {
  const opts: { id: FillStyle; label: string; preview: string }[] = [
    { id: 'solid', label: 'Plain', preview: '🎨' },
    { id: 'rainbow', label: 'Rainbow', preview: '🌈' },
    { id: 'glitter', label: 'Sparkle', preview: '✨' },
  ];
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Fill style">
      {opts.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={style === o.id}
          onClick={() => setStyle(o.id)}
          className={`btn h-12 w-[72px] shrink-0 flex-col gap-0 text-xs leading-tight ${style === o.id ? 'bg-grape-500 text-white shadow-pop-sm' : 'bg-white shadow-pop-sm'}`}
        >
          <span aria-hidden="true" className="text-base">{o.preview}</span> {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, setOn, label, emoji }: { on: boolean; setOn: (v: boolean) => void; label: string; emoji: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      className={`btn h-11 shrink-0 px-3 text-sm ${on ? 'bg-mint-400 text-ink shadow-pop-sm' : 'bg-white text-ink/60 shadow-pop-sm'}`}
      title={label}
    >
      <span aria-hidden="true">{emoji}</span>
      <span>{label}</span>
      <span className={`ml-1 inline-block h-5 w-9 rounded-full p-0.5 transition ${on ? 'bg-white/70' : 'bg-ink/15'}`}>
        <span className={`block h-4 w-4 rounded-full transition ${on ? 'translate-x-4 bg-mint-500' : 'bg-white'}`} />
      </span>
    </button>
  );
}
