import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Camera, ImagePlus, Loader2, Wand2, ArrowLeft, Sparkles } from 'lucide-react';
import { BackBar } from '../components/BackBar';
import {
  analyzeImage, canvasToBlob, convertToLineArt, createCanvas, ctx2d, imageToCanvas, loadImage, DEFAULT_CONVERT, type ConvertMode, type ConvertSettings,
} from '../lib/imageProcessing';
import { detectRegions } from '../lib/regionClient';
import { newId, saveProject } from '../lib/storage';
import { navigate } from '../lib/router';
import { hslToHex, hexToRgb } from '../lib/colors';
import { getAiStatus, type AiStatus } from '../lib/aiRedraw';
import { AiRedrawDialog } from '../components/AiRedrawDialog';

const FINAL_SIDE = 1600;
const PREVIEW_SIDE = 720;
const ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp,.svg,.png,.jpg,.jpeg,.webp';

interface Loaded {
  name: string;
  full: HTMLCanvasElement;
  preview: ImageData;
  originalUrl: string;
  looksLikeDrawing: boolean;
  /** set when this is an AI redraw; holds the picture it was made from */
  original?: Loaded;
}

function makeLoaded(img: HTMLImageElement, name: string, url: string): Loaded {
  const full = imageToCanvas(img, FINAL_SIDE);
  const ps = Math.min(1, PREVIEW_SIDE / Math.max(full.width, full.height));
  const pc = createCanvas(Math.round(full.width * ps), Math.round(full.height * ps));
  const pctx = ctx2d(pc);
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(full, 0, 0, pc.width, pc.height);
  const preview = pctx.getImageData(0, 0, pc.width, pc.height);
  return { name, full, preview, originalUrl: url, looksLikeDrawing: analyzeImage(preview).looksLikeDrawing };
}

export function Upload() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type) && !/\.(png|jpe?g|svg|webp)$/i.test(file.name)) {
      setError('Please choose a PNG, JPG, SVG or WEBP picture.');
      return;
    }
    setLoading(true);
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setLoaded(makeLoaded(img, base ? base[0].toUpperCase() + base.slice(1, 40) : 'My drawing', url));
    } catch {
      setError("Oops! We couldn't open that picture. Try a PNG or JPG.");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files?.[0]);
  };

  if (loaded) return <Adjust key={loaded.originalUrl} loaded={loaded} onBack={() => setLoaded(null)} onReplace={setLoaded} />;

  return (
    <div className="home-bg min-h-full">
      <BackBar title="📷 Colour my own picture" />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`panel flex flex-col items-center gap-5 border-4 border-dashed px-6 py-12 text-center transition ${dragging ? 'border-grape-500 bg-grape-50' : 'border-grape-200'}`}
        >
          <div className="text-7xl animate-floaty" aria-hidden="true">🖼️</div>
          <h2 className="text-3xl font-bold">Turn any picture into a colouring page!</h2>
          <p className="max-w-md text-lg text-ink/70">
            Pick a drawing you made, a scanned colouring sheet, or even a photo. We&apos;ll find the lines for you.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-lg font-semibold text-grape-600">
              <Loader2 className="animate-spin" /> Opening picture…
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn bg-grape-500 px-7 py-4 text-xl text-white shadow-pop" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={26} /> Choose a picture
              </button>
              <button className="btn bg-sunny-400 px-7 py-4 text-xl text-ink shadow-pop" onClick={() => camRef.current?.click()}>
                <Camera size={26} /> Take a photo
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {error && <p className="rounded-2xl bg-bubble-300/40 px-4 py-2 font-semibold text-bubble-500">{error}</p>}
          <p className="text-sm text-ink/50">PNG · JPG · SVG · WEBP — your picture never leaves this device 🔒</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['✏️', 'Best results', 'Dark, thick lines on white paper work best.'],
            ['💡', 'Photos too', 'Photos are turned into outlines — try the sliders to tidy them up.'],
            ['🪄', 'Leaky lines?', 'Turn up "Leak guard" to close little gaps in the lines.'],
          ].map(([e, t, d]) => (
            <div key={t} className="panel p-4">
              <div className="text-3xl">{e}</div>
              <div className="mt-1 font-bold">{t}</div>
              <div className="text-sm text-ink/60">{d}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Slider({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm font-semibold">
        <span>{label}</span>
        <span className="text-ink/50">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="slider w-full" />
      {hint && <div className="mt-0.5 text-xs text-ink/50">{hint}</div>}
    </label>
  );
}

function Adjust({ loaded, onBack, onReplace }: { loaded: Loaded; onBack: () => void; onReplace: (l: Loaded) => void }) {
  const [s, setS] = useState<ConvertSettings>(() => ({ ...DEFAULT_CONVERT, mode: loaded.looksLikeDrawing ? 'drawing' : 'photo', sensitivity: loaded.looksLikeDrawing ? 50 : 45 }));
  const [gap, setGap] = useState(loaded.original ? 1 : loaded.looksLikeDrawing ? 2 : 3);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  useEffect(() => {
    void getAiStatus().then(setAi);
  }, []);
  const onAiResult = async (dataUrl: string) => {
    const img = await loadImage(dataUrl);
    const next = makeLoaded(img, loaded.name, dataUrl);
    onReplace({ ...next, looksLikeDrawing: true, original: loaded.original ?? loaded });
  };
  const [zones, setZones] = useState(false);
  const [info, setInfo] = useState<{ spaces: number; biggest: number } | null>(null);
  const [working, setWorking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [name, setName] = useState(loaded.name);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    setWorking(true);
    const t = window.setTimeout(async () => {
      const { preview } = loaded;
      const ink = convertToLineArt(preview, s);
      const w = preview.width;
      const h = preview.height;
      const alpha = new Uint8Array(w * h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = ink.data[i * 4 + 3];
      // leak guard is measured in full-size pixels; scale it for the preview
      const ratio = Math.max(w, h) / Math.max(loaded.full.width, loaded.full.height);
      const regions = await detectRegions(alpha, w, h, gap > 0 ? Math.max(1, Math.round(gap * ratio)) : 0);
      if (cancelled) return;
      const N = w * h;
      let spaces = 0;
      let biggest = 0;
      for (let l = 1; l <= regions.count; l++) {
        if (regions.areas[l] > N * 0.0004) spaces++;
        biggest = Math.max(biggest, regions.areas[l] / N);
      }
      setInfo({ spaces, biggest });
      const c = canvasRef.current!;
      c.width = w;
      c.height = h;
      const ctx = ctx2d(c);
      const out = new ImageData(w, h);
      const o = out.data;
      const lut: [number, number, number][] = [];
      for (let l = 0; l <= regions.count; l++) lut.push(hexToRgb(hslToHex((l * 137.508) % 360, 80, 72)));
      for (let i = 0; i < N; i++) {
        const a = ink.data[i * 4 + 3] / 255;
        let r = 255;
        let g2 = 255;
        let b = 255;
        if (zones) [r, g2, b] = lut[regions.labels[i]] ?? [255, 255, 255];
        o[i * 4] = r * (1 - a) + 27 * a;
        o[i * 4 + 1] = g2 * (1 - a) + 27 * a;
        o[i * 4 + 2] = b * (1 - a) + 27 * a;
        o[i * 4 + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      setWorking(false);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [s, gap, zones, loaded]);

  const start = async () => {
    setStarting(true);
    try {
      const { full } = loaded;
      const data = ctx2d(full).getImageData(0, 0, full.width, full.height);
      const ink = convertToLineArt(data, s);
      const c = createCanvas(full.width, full.height);
      ctx2d(c).putImageData(ink, 0, 0);
      const lineArt = await canvasToBlob(c);
      const now = Date.now();
      const id = newId();
      try {
        await saveProject({
          id,
          name: name.trim() || 'My drawing',
          source: { type: 'upload', lineArt, width: full.width, height: full.height },
          gap,
          colorLayer: null,
          stickerLayer: null,
          thumbnail: await canvasToBlob(c, 'image/png'),
          finished: false,
          createdAt: now,
          updatedAt: now,
        });
      } catch {
        /* kept in memory for this visit */
      }
      navigate(`/project/${id}`);
    } finally {
      setStarting(false);
    }
  };

  const modes: { id: ConvertMode; label: string; emoji: string; hint: string }[] = [
    { id: 'drawing', label: 'Drawing', emoji: '✏️', hint: 'For line drawings & colouring sheets' },
    { id: 'photo', label: 'Photo', emoji: '📸', hint: 'Finds the edges in a photo' },
    { id: 'asis', label: 'Keep as is', emoji: '🖼️', hint: 'Use the picture exactly' },
  ];
  const set = (patch: Partial<ConvertSettings>) => setS((o) => ({ ...o, ...patch }));
  const leaky = info && (info.spaces < 4 || info.biggest > 0.9);

  return (
    <div className="home-bg min-h-full">
      <BackBar
        title="🪄 Get your page ready"
        right={
          <button className="btn bg-white px-4 py-3 shadow-pop-sm" onClick={onBack}>
            <ArrowLeft size={20} /> <span className="hidden sm:inline">Different picture</span>
          </button>
        }
      />
      <main className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 pt-5 lg:grid-cols-[1fr_360px]">
        <section className="panel p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-ink/60">
              {loaded.original ? '✨ Here is your magic colouring page!' : loaded.looksLikeDrawing ? '✏️ This looks like a drawing!' : '📸 This looks like a photo — we turned it into outlines.'}
            </div>
            <button
              role="switch"
              aria-checked={zones}
              onClick={() => setZones(!zones)}
              className={`btn px-3 py-2 text-sm ${zones ? 'bg-grape-500 text-white' : 'bg-grape-50 text-grape-700'}`}
            >
              🌈 {zones ? 'Hide' : 'Show'} colour spaces
            </button>
          </div>
          <div className="relative grid gap-3 sm:grid-cols-[140px_1fr]">
            <div className="hidden sm:block">
              <div className="label mb-1">Original</div>
              <img src={(loaded.original ?? loaded).originalUrl} alt="Your original picture" className="checker w-full rounded-xl object-contain shadow-pop-sm" />
            </div>
            <div className="relative">
              <div className="label mb-1">Colouring page</div>
              <canvas ref={canvasRef} className="mx-auto block max-h-[62vh] w-auto max-w-full rounded-xl bg-white shadow-pop-sm" />
              {working && (
                <div className="absolute right-2 top-7 rounded-full bg-white/90 p-1.5 shadow">
                  <Loader2 className="animate-spin text-grape-500" size={20} />
                </div>
              )}
            </div>
          </div>
          {info && (
            <p className={`mt-3 rounded-2xl px-4 py-2 text-sm font-semibold ${leaky ? 'bg-sunny-300/60' : 'bg-mint-300/50'}`}>
              {leaky
                ? `⚠️ Only ${info.spaces} colouring spaces found — some lines may have gaps. Try turning up "Leak guard" or "Line thickness", or switch mode.`
                : `✅ Found ${info.spaces} colouring spaces. Tap "Show colour spaces" to check each area gets its own colour.`}
            </p>
          )}
        </section>

        <section className="panel space-y-5 p-4">
          {loaded.original ? (
            <div className="rounded-2xl bg-grape-50 p-3">
              <div className="font-bold text-grape-700">✨ Redrawn by AI magic</div>
              <div className="mt-2 flex gap-2">
                <button className="btn flex-1 bg-white py-2 text-sm shadow-pop-sm" onClick={() => onReplace(loaded.original!)}>
                  ↩️ Use my original
                </button>
                {ai?.enabled && (
                  <button className="btn flex-1 bg-white py-2 text-sm shadow-pop-sm" onClick={() => setAiOpen(true)}>
                    🔁 Redraw again
                  </button>
                )}
              </div>
            </div>
          ) : (
            ai?.enabled && (
              <button className="btn w-full flex-col gap-0 bg-gradient-to-r from-grape-500 via-bubble-400 to-tangerine-400 py-3 text-white shadow-pop" onClick={() => setAiOpen(true)}>
                <span className="text-lg">✨ AI Magic Redraw</span>
                <span className="text-xs font-medium opacity-90">Turns any picture into perfect colouring lines</span>
              </button>
            )
          )}
          <label className="block">
            <div className="label mb-1">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="w-full rounded-xl border-2 border-grape-100 px-3 py-2 text-lg font-semibold focus:border-grape-400 focus:outline-none" />
          </label>
          <div>
            <div className="label mb-2">Picture type</div>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => set({ mode: m.id })}
                  aria-pressed={s.mode === m.id}
                  title={m.hint}
                  className={`btn flex-col gap-0 py-2.5 text-sm ${s.mode === m.id ? 'bg-grape-500 text-white shadow-pop-sm' : 'bg-white shadow-pop-sm'}`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <Slider label="Contrast" value={s.contrast} min={-50} max={100} onChange={(v) => set({ contrast: v })} />
          {s.mode !== 'asis' && (
            <Slider label="Line sensitivity" value={s.sensitivity} min={0} max={100} onChange={(v) => set({ sensitivity: v })} hint="Higher finds fainter lines" />
          )}
          <Slider label="Line thickness" value={s.thickness} min={0} max={4} onChange={(v) => set({ thickness: v })} hint="Thicker lines leak less" />
          <Slider label="Clean up specks" value={s.cleanup} min={0} max={100} onChange={(v) => set({ cleanup: v })} hint="Removes little dots and smudges" />
          <Slider label="Leak guard (fill tolerance)" value={gap} min={0} max={8} onChange={setGap} hint="Closes small gaps so colour stays inside" />
          <button
            className="btn w-full bg-tangerine-500 py-2.5 text-white shadow-pop-sm"
            onClick={() => {
              setS({ ...DEFAULT_CONVERT, mode: loaded.looksLikeDrawing ? 'drawing' : 'photo' });
              setGap(2);
            }}
          >
            <Wand2 size={20} /> Magic auto settings
          </button>
          <button disabled={starting} className="btn w-full bg-grape-500 py-4 text-xl text-white shadow-pop" onClick={start}>
            {starting ? <Loader2 className="animate-spin" /> : <Sparkles />} Start colouring!
          </button>
        </section>
      </main>
      <AiRedrawDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        source={(loaded.original ?? loaded).full}
        passcodeRequired={!!ai?.passcode}
        onResult={(url) => {
          setAiOpen(false);
          void onAiResult(url);
        }}
      />
    </div>
  );
}
