import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
  Home as HomeIcon, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save, Download, Printer, RotateCcw, Settings, MoreHorizontal, PartyPopper, Loader2,
} from 'lucide-react';
import { ColoringEngine, type FillStyle, type Tool } from '../lib/engine';
import { getPage, type ColoringPage } from '../data/pages';
import { blobToCanvas, canvasToBlob, renderPageInk } from '../lib/imageProcessing';
import { getProject, newId, saveProject, type Project } from '../lib/storage';
import { navigate } from '../lib/router';
import { getPref, setPref } from '../lib/prefs';
import { sounds, isMuted, setMuted } from '../lib/sound';
import { downloadCanvas, printCanvas, renderArtwork } from '../lib/exporter';
import {
  TOOLS, ToolButton, PaletteGrid, ColorExtras, SizePicker, StickerPicker, FillStylePicker, Toggle, BRUSH_SIZES, STICKERS,
} from '../components/Tools';
import { Modal } from '../components/Modal';
import { Confetti } from '../components/Confetti';

const PAGE_SIZE = 1600;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export const THEMES = [
  { id: 'sunshine', name: 'Sunshine', emoji: '☀️' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊' },
  { id: 'meadow', name: 'Meadow', emoji: '🌿' },
  { id: 'candy', name: 'Candy', emoji: '🍬' },
  { id: 'space', name: 'Space', emoji: '🌌' },
  { id: 'plain', name: 'Plain', emoji: '⬜' },
];

interface View {
  zoom: number;
  panX: number;
  panY: number;
}

const PRAISE = ['Amazing work!', 'What a masterpiece!', 'You are a superstar artist!', 'Wow, so colourful!', 'Beautiful job!'];

export function Workspace({ pageId, projectId }: { pageId?: string; projectId?: string }) {
  const colorRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const stickerRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ColoringEngine | null>(null);
  const projectRef = useRef<Project | null>(null);
  const pageRef = useRef<ColoringPage | undefined>();
  const savedVersion = useRef(0);
  const saveTimer = useRef<number>();
  const savingRef = useRef<Promise<void> | null>(null);

  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dims, setDims] = useState({ w: PAGE_SIZE, h: PAGE_SIZE });
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [view, setViewState] = useState<View>({ zoom: 1, panX: 0, panY: 0 });
  const viewRef = useRef(view);

  const [tool, setTool] = useState<Tool>('fill');
  const [color, setColor] = useState(() => getPref('color', '#ff4797'));
  const [hue, setHue] = useState(320);
  const [sizeIdx, setSizeIdx] = useState(2);
  const [fillStyle, setFillStyle] = useState<FillStyle>('solid');
  const [smart, setSmart] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [sticker, setSticker] = useState(STICKERS[0]);
  const [theme, setTheme] = useState(() => getPref('theme', 'sunshine'));
  const [gap, setGap] = useState(0);
  const [muted, setMutedState] = useState(isMuted());

  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [praise, setPraise] = useState(PRAISE[0]);
  const [busy, setBusy] = useState(false);

  // latest settings for the (stable) pointer handlers
  const settings = useRef({ tool, color, sizeIdx, fillStyle, smart, mirror, sticker });
  settings.current = { tool, color, sizeIdx, fillStyle, smart, mirror, sticker };

  useEffect(() => setPref('color', color), [color]);
  useEffect(() => setPref('theme', theme), [theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }, []);

  // --------------------------------------------------------------- saving

  const saveNow = useCallback(async (opts: { force?: boolean; finished?: boolean } = {}) => {
    const eng = engineRef.current;
    if (!eng || !eng.width) return;
    if (savingRef.current) await savingRef.current;
    const version = eng.version;
    if (!opts.force && !opts.finished && version === savedVersion.current) return;
    if (!projectRef.current && eng.isBlank() && !opts.force && !opts.finished) return;
    const job = (async () => {
      const [colorLayer, stickerLayer, thumbnail] = await Promise.all([
        canvasToBlob(eng.colorCanvas),
        canvasToBlob(eng.stickerCanvas),
        canvasToBlob(eng.thumbnail(), 'image/jpeg', 0.86),
      ]);
      const now = Date.now();
      const page = pageRef.current;
      const base: Project = projectRef.current ?? {
        id: newId(),
        name: page?.title ?? 'My picture',
        source: { type: 'preset', pageId: page?.id ?? '' },
        gap: eng.gap,
        colorLayer: null,
        stickerLayer: null,
        thumbnail: null,
        finished: false,
        createdAt: now,
        updatedAt: now,
      };
      const proj: Project = {
        ...base,
        colorLayer,
        stickerLayer,
        thumbnail,
        gap: eng.gap,
        updatedAt: now,
        finished: base.finished || !!opts.finished,
      };
      await saveProject(proj);
      const firstSave = !projectRef.current;
      projectRef.current = proj;
      savedVersion.current = version;
      if (firstSave) window.history.replaceState(null, '', `#/project/${proj.id}`);
    })();
    savingRef.current = job.catch(() => {}).finally(() => (savingRef.current = null));
    try {
      await job;
    } catch {
      if (opts.force) showToast('Hmm, saving is not available in this browser');
      throw new Error('save failed');
    }
  }, [showToast]);

  const scheduleSave = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveNow().catch(() => {}), 1500);
  }, [saveNow]);

  // ---------------------------------------------------------------- loading

  useEffect(() => {
    let cancelled = false;
    const eng = new ColoringEngine(colorRef.current!, lineRef.current!, stickerRef.current!);
    engineRef.current = eng;
    eng.onReady = (r) => !cancelled && setReady(r);
    eng.onChange = () => {
      bump();
      scheduleSave();
    };
    (async () => {
      try {
        let ink: HTMLCanvasElement;
        let page: ColoringPage | undefined;
        let proj: Project | null = null;
        let g = 0;
        if (projectId) {
          proj = (await getProject(projectId)) ?? null;
          if (!proj) throw new Error('We could not find that saved picture.');
          if (proj.source.type === 'preset') {
            page = getPage(proj.source.pageId);
            if (!page) throw new Error('That page is missing.');
            ink = await renderPageInk(page, PAGE_SIZE);
          } else {
            ink = await blobToCanvas(proj.source.lineArt);
          }
          g = proj.gap;
        } else {
          page = getPage(pageId!);
          if (!page) throw new Error('That page is missing.');
          ink = await renderPageInk(page, PAGE_SIZE);
          g = page.gap ?? 0;
        }
        if (cancelled) return;
        pageRef.current = page;
        projectRef.current = proj;
        setTitle(proj?.name ?? page?.title ?? 'My picture');
        setGap(g);
        setDims({ w: ink.width, h: ink.height });
        const regionsDone = eng.setup(ink, g);
        if (proj && (proj.colorLayer || proj.stickerLayer)) {
          const [cl, st] = await Promise.all([
            proj.colorLayer ? blobToCanvas(proj.colorLayer) : null,
            proj.stickerLayer ? blobToCanvas(proj.stickerLayer) : null,
          ]);
          if (cancelled) return;
          eng.loadLayers(cl, st);
        }
        savedVersion.current = eng.version;
        setLoading(false);
        await regionsDone;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    })();
    const onHide = () => document.visibilityState === 'hidden' && void saveNow().catch(() => {});
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onHide);
      window.clearTimeout(saveTimer.current);
      void saveNow().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ view / zoom

  useLayoutEffect(() => {
    const el = stageRef.current!;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const pad = stage.w < 500 ? 10 : 24;
  const fit = stage.w && stage.h ? Math.min((stage.w - pad * 2) / dims.w, (stage.h - pad * 2) / dims.h) : 0;
  const layout = useRef({ fit, stage, dims });
  layout.current = { fit, stage, dims };

  const clampView = useCallback((v: View): View => {
    const { fit: f, stage: s, dims: d } = layout.current;
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom));
    const W = d.w * f * zoom;
    const H = d.h * f * zoom;
    const mx = Math.max(0, (W - s.w) / 2 + s.w * 0.35);
    const my = Math.max(0, (H - s.h) / 2 + s.h * 0.35);
    if (zoom === 1) return { zoom, panX: 0, panY: 0 };
    return { zoom, panX: Math.max(-mx, Math.min(mx, v.panX)), panY: Math.max(-my, Math.min(my, v.panY)) };
  }, []);

  const setView = useCallback((v: View) => {
    const c = clampView(v);
    viewRef.current = c;
    setViewState(c);
  }, [clampView]);

  /** zoom by factor keeping stage point (sx, sy) fixed */
  const zoomAt = useCallback((factor: number, sx?: number, sy?: number) => {
    const { fit: f, stage: s, dims: d } = layout.current;
    const v = viewRef.current;
    const px = sx ?? s.w / 2;
    const py = sy ?? s.h / 2;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
    const W0 = d.w * f * v.zoom;
    const H0 = d.h * f * v.zoom;
    const left0 = s.w / 2 - W0 / 2 + v.panX;
    const top0 = s.h / 2 - H0 / 2 + v.panY;
    const u = (px - left0) / W0;
    const t = (py - top0) / H0;
    const W1 = d.w * f * z;
    const H1 = d.h * f * z;
    setView({ zoom: z, panX: px - u * W1 - s.w / 2 + W1 / 2, panY: py - t * H1 - s.h / 2 + H1 / 2 });
  }, [setView]);

  // ------------------------------------------------------- pointer handling

  useEffect(() => {
    const el = stageRef.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    type Mode = 'none' | 'draw' | 'tap' | 'pan' | 'pinch' | 'ignore';
    let mode: Mode = 'none';
    let tap = { x: 0, y: 0 };
    let panStart = { x: 0, y: 0, panX: 0, panY: 0 };
    let pinch = { dist: 1, midX: 0, midY: 0, view: viewRef.current };
    let spaceDown = false;

    const stagePt = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return { x: cx - r.left, y: cy - r.top };
    };
    const canvasPt = (cx: number, cy: number) => {
      const eng = engineRef.current!;
      const r = wrapRef.current!.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * eng.width, y: ((cy - r.top) / r.height) * eng.height };
    };
    const brushPx = () => BRUSH_SIZES[settings.current.sizeIdx] * (engineRef.current?.width || PAGE_SIZE);

    const updateCursor = (e: PointerEvent) => {
      const cur = cursorRef.current;
      if (!cur) return;
      const t = settings.current.tool;
      const show = e.pointerType !== 'touch' && ['brush', 'rainbow', 'glitter', 'eraser'].includes(t) && mode !== 'pan' && mode !== 'pinch';
      if (!show) {
        cur.style.display = 'none';
        return;
      }
      const r = wrapRef.current!.getBoundingClientRect();
      const d = (brushPx() * r.width) / (engineRef.current?.width || PAGE_SIZE);
      const p = stagePt(e.clientX, e.clientY);
      cur.style.display = 'block';
      cur.style.width = cur.style.height = `${d}px`;
      cur.style.transform = `translate(${p.x - d / 2}px, ${p.y - d / 2}px)`;
    };

    const startPinch = () => {
      const [a, b] = [...pointers.values()];
      const m = stagePt((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), midX: m.x, midY: m.y, view: viewRef.current };
    };

    const onControl = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('button, a, input');

    const down = (e: PointerEvent) => {
      if (onControl(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
      const eng = engineRef.current;
      if (!eng || !eng.width) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        if (mode === 'draw') eng.cancelStroke();
        mode = 'pinch';
        startPinch();
        return;
      }
      if (pointers.size > 2 || mode === 'ignore') return;
      const s = settings.current;
      if (s.tool === 'pan' || e.button === 1 || spaceDown) {
        mode = 'pan';
        const v = viewRef.current;
        panStart = { x: e.clientX, y: e.clientY, panX: v.panX, panY: v.panY };
        el.style.cursor = 'grabbing';
        return;
      }
      const pt = canvasPt(e.clientX, e.clientY);
      if (s.tool === 'fill' || s.tool === 'sticker') {
        mode = 'tap';
        tap = { x: e.clientX, y: e.clientY };
        return;
      }
      mode = 'draw';
      eng.beginStroke(pt.x, pt.y, {
        tool: s.tool as 'brush' | 'rainbow' | 'glitter' | 'eraser',
        color: s.color,
        size: brushPx(),
        smart: s.smart,
        mirror: s.mirror,
      });
    };

    const move = (e: PointerEvent) => {
      updateCursor(e);
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const eng = engineRef.current!;
      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
        const m = stagePt((a.x + b.x) / 2, (a.y + b.y) / 2);
        const { fit: f, stage: s, dims: d } = layout.current;
        const v0 = pinch.view;
        const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (v0.zoom * dist) / pinch.dist));
        const W0 = d.w * f * v0.zoom;
        const H0 = d.h * f * v0.zoom;
        const u = (pinch.midX - (s.w / 2 - W0 / 2 + v0.panX)) / W0;
        const t = (pinch.midY - (s.h / 2 - H0 / 2 + v0.panY)) / H0;
        const W1 = d.w * f * z;
        const H1 = d.h * f * z;
        setView({ zoom: z, panX: m.x - u * W1 - s.w / 2 + W1 / 2, panY: m.y - t * H1 - s.h / 2 + H1 / 2 });
      } else if (mode === 'pan') {
        setView({ zoom: viewRef.current.zoom, panX: panStart.panX + e.clientX - panStart.x, panY: panStart.panY + e.clientY - panStart.y });
      } else if (mode === 'draw') {
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        const list = events.length ? events : [e];
        for (const ev of list) {
          const pt = canvasPt(ev.clientX, ev.clientY);
          eng.moveStroke(pt.x, pt.y);
        }
      }
    };

    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      const eng = engineRef.current!;
      const s = settings.current;
      if (mode === 'draw') {
        eng.endStroke();
        mode = 'none';
      } else if (mode === 'tap') {
        if (e.type !== 'pointercancel' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 14) {
          const pt = canvasPt(e.clientX, e.clientY);
          if (s.tool === 'fill') {
            if (!eng.ready) showToast('Getting your crayons ready…');
            else if (eng.fill(pt.x, pt.y, s.color, s.fillStyle, s.mirror)) sounds.fill();
          } else if (s.tool === 'sticker') {
            eng.stamp(pt.x, pt.y, s.sticker, brushPx() * 2.6 + eng.width * 0.03, s.mirror);
            sounds.pop();
          }
        }
        mode = 'none';
      } else if (mode === 'pan') {
        el.style.cursor = '';
        mode = 'none';
      } else if (mode === 'pinch') {
        mode = pointers.size ? 'ignore' : 'none';
      }
      if (!pointers.size) mode = 'none';
    };

    const leave = () => {
      if (cursorRef.current) cursorRef.current.style.display = 'none';
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = stagePt(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
        zoomAt(factor, p.x, p.y);
      }
    };

    const keydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const eng = engineRef.current;
      if (!eng) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) eng.redo();
        else eng.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        eng.redo();
      } else if (e.key === '+' || e.key === '=') zoomAt(1.25);
      else if (e.key === '-') zoomAt(0.8);
      else if (e.key === '0') setView({ zoom: 1, panX: 0, panY: 0 });
      else if (e.key === ' ') {
        spaceDown = true;
        el.style.cursor = 'grab';
        e.preventDefault();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceDown = false;
        el.style.cursor = '';
      }
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('wheel', wheel, { passive: false });
    const noTouch = (e: TouchEvent) => !onControl(e.target) && e.preventDefault();
    el.addEventListener('touchstart', noTouch, { passive: false });
    el.addEventListener('touchmove', noTouch, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('touchstart', noTouch);
      el.removeEventListener('touchmove', noTouch);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
  }, [setView, zoomAt, showToast]);

  // ----------------------------------------------------------------- actions

  const eng = engineRef.current;
  const undo = () => eng?.undo() && sounds.undo();
  const redo = () => eng?.redo() && sounds.undo();

  const goHome = async () => {
    try {
      await saveNow();
    } catch {
      /* ignore */
    }
    navigate('/');
  };

  const doSave = async () => {
    try {
      await saveNow({ force: true });
      showToast('Saved to My Masterpieces! 💜');
    } catch {
      /* toast shown */
    }
  };

  const doDownload = async () => {
    if (!eng) return;
    setBusy(true);
    try {
      const art = await renderArtwork(eng, pageRef.current?.svg);
      await downloadCanvas(art, title);
      showToast('Picture downloaded! 🖼️');
    } finally {
      setBusy(false);
    }
  };

  const doPrint = async () => {
    if (!eng) return;
    setBusy(true);
    try {
      const art = await renderArtwork(eng, pageRef.current?.svg, 2400);
      await printCanvas(art, title);
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    setCelebrate(true);
    setConfetti((c) => c + 1);
    sounds.tada();
    try {
      await saveNow({ finished: true });
    } catch {
      /* ignore */
    }
  };

  const changeGap = (g: number) => {
    setGap(g);
    void eng?.setGap(g).then(() => scheduleSave());
  };

  const pickColor = (hex: string) => {
    setColor(hex);
    if (tool === 'eraser' || tool === 'pan' || tool === 'sticker') setTool('fill');
    sounds.click();
  };

  // ------------------------------------------------------------------ render

  const W = dims.w * fit * view.zoom;
  const H = dims.h * fit * view.zoom;
  const left = stage.w / 2 - W / 2 + view.panX;
  const top = stage.h / 2 - H / 2 + view.panY;
  const isBrush = ['brush', 'rainbow', 'glitter', 'eraser'].includes(tool);
  const showSize = isBrush || tool === 'sticker';

  const actionButtons = (
    <>
      <button className="btn-icon" onClick={() => setResetOpen(true)} aria-label="Start again" title="Start again">
        <RotateCcw size={22} />
      </button>
      <button className="btn-icon" onClick={doSave} aria-label="Save" title="Save">
        <Save size={22} />
      </button>
      <button className="btn-icon" onClick={doDownload} aria-label="Download picture" title="Download PNG" disabled={busy}>
        <Download size={22} />
      </button>
      <button className="btn-icon" onClick={doPrint} aria-label="Print picture" title="Print" disabled={busy}>
        <Printer size={22} />
      </button>
      <button className="btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
        <Settings size={22} />
      </button>
    </>
  );

  const toolOptions = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:flex-nowrap">
      {tool === 'fill' && <FillStylePicker style={fillStyle} setStyle={setFillStyle} />}
      {showSize && <SizePicker size={sizeIdx} setSize={setSizeIdx} color={tool === 'eraser' ? '#aeb6c2' : color} />}
      {isBrush && <Toggle on={smart} setOn={setSmart} label="Stay in lines" emoji="🪄" />}
      {tool !== 'pan' && <Toggle on={mirror} setOn={setMirror} label="Mirror" emoji="🦋" />}
    </div>
  );

  return (
    <div className={`theme-${theme} fixed inset-0 flex flex-col overflow-hidden`}>
      {/* top bar */}
      <header className="z-20 flex items-center gap-1.5 bg-white/85 px-2 py-2 shadow-[0_2px_10px_rgba(43,35,80,0.08)] backdrop-blur sm:gap-2 sm:px-3">
        <button className="btn-icon" onClick={goHome} aria-label="Home" title="Home">
          <HomeIcon size={22} />
        </button>
        <h1 className="ml-1 hidden min-w-0 truncate text-xl font-bold sm:block">{title}</h1>
        <div className="flex-1" />
        <button className="btn-icon" onClick={undo} disabled={!eng?.canUndo} aria-label="Undo" title="Undo">
          <Undo2 size={22} />
        </button>
        <button className="btn-icon" onClick={redo} disabled={!eng?.canRedo} aria-label="Redo" title="Redo">
          <Redo2 size={22} />
        </button>
        <div className="mx-1 hidden items-center gap-1.5 md:flex">
          <button className="btn-icon" onClick={() => zoomAt(0.8)} aria-label="Zoom out" title="Zoom out">
            <ZoomOut size={22} />
          </button>
          <button className="btn h-11 min-w-[64px] bg-white px-2 text-sm shadow-pop-sm" onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })} title="Fit to screen">
            {Math.round(view.zoom * 100)}%
          </button>
          <button className="btn-icon" onClick={() => zoomAt(1.25)} aria-label="Zoom in" title="Zoom in">
            <ZoomIn size={22} />
          </button>
        </div>
        <div className="hidden items-center gap-1.5 lg:flex">{actionButtons}</div>
        <div className="relative lg:hidden">
          <button className="btn-icon" onClick={() => setMenuOpen((o) => !o)} aria-label="More" aria-expanded={menuOpen}>
            <MoreHorizontal size={22} />
          </button>
          {menuOpen && (
            <div className="panel absolute right-0 top-14 z-40 grid w-56 gap-1 p-2 animate-popin" onClick={() => setMenuOpen(false)}>
              {[
                { label: 'Save', icon: <Save size={20} />, on: doSave },
                { label: 'Download PNG', icon: <Download size={20} />, on: doDownload },
                { label: 'Print', icon: <Printer size={20} />, on: doPrint },
                { label: 'Zoom in', icon: <ZoomIn size={20} />, on: () => zoomAt(1.25) },
                { label: 'Zoom out', icon: <ZoomOut size={20} />, on: () => zoomAt(0.8) },
                { label: 'Start again', icon: <RotateCcw size={20} />, on: () => setResetOpen(true) },
                { label: 'Settings', icon: <Settings size={20} />, on: () => setSettingsOpen(true) },
              ].map((it) => (
                <button key={it.label} className="btn justify-start rounded-xl px-3 py-3 text-left hover:bg-grape-50" onClick={it.on}>
                  {it.icon} {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn ml-1 h-11 bg-mint-400 px-3 text-ink shadow-pop-sm hover:bg-mint-300 sm:px-4" onClick={doFinish}>
          <PartyPopper size={22} /> <span className="hidden sm:inline">I&apos;m done!</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* left tool rail (tablet / desktop) */}
        <aside className="no-scrollbar hidden flex-col items-center gap-2.5 overflow-y-auto p-3 md:flex" aria-label="Tools">
          {TOOLS.map((t) => (
            <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => setTool(t.id)} />
          ))}
        </aside>

        {/* canvas stage */}
        <main ref={stageRef} className="stage relative min-h-0 flex-1 overflow-hidden" aria-label="Colouring page">
          <div
            ref={wrapRef}
            className="absolute overflow-hidden rounded-2xl bg-white shadow-soft"
            style={{ left, top, width: W, height: H, visibility: fit ? 'visible' : 'hidden' }}
          >
            <canvas ref={colorRef} />
            <canvas ref={lineRef} />
            <canvas ref={stickerRef} />
          </div>
          <div ref={cursorRef} className="pointer-events-none absolute left-0 top-0 hidden rounded-full border-2 border-ink/60 shadow-[0_0_0_2px_rgba(255,255,255,0.8)]" />
          {(loading || error) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="panel flex flex-col items-center gap-3 px-8 py-6 text-center">
                {error ? (
                  <>
                    <span className="text-4xl">🙈</span>
                    <p className="text-lg font-semibold">{error}</p>
                    <button className="btn bg-grape-500 px-5 py-3 text-white shadow-pop" onClick={() => navigate('/')}>
                      Go home
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="animate-spin text-grape-500" size={40} />
                    <p className="text-lg font-semibold">Getting your page ready…</p>
                  </>
                )}
              </div>
            </div>
          )}
          {!loading && !ready && !error && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold shadow-soft">
              🖍️ Finding the colouring spaces…
            </div>
          )}
          {view.zoom > 1.01 && (
            <button className="btn absolute bottom-3 right-3 h-11 bg-white px-3 text-sm shadow-pop-sm" onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}>
              <Maximize size={18} /> Fit
            </button>
          )}
          {toast && (
            <div role="status" className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 animate-popin whitespace-nowrap rounded-full bg-ink px-5 py-2.5 font-semibold text-white shadow-soft">
              {toast}
            </div>
          )}
        </main>

        {/* right panel (tablet / desktop) */}
        <aside className="no-scrollbar hidden w-[284px] shrink-0 flex-col gap-3 overflow-y-auto p-3 md:flex">
          <section className="panel p-3">
            <div className="label mb-2">{TOOLS.find((t) => t.id === tool)?.label}</div>
            {toolOptions}
            {tool === 'pan' && <p className="text-sm text-ink/60">Drag the picture to move around. Pinch or scroll to zoom.</p>}
          </section>
          {tool === 'sticker' ? (
            <section className="panel p-3">
              <div className="label mb-2">Pick a sticker</div>
              <StickerPicker sticker={sticker} setSticker={setSticker} layout="grid" />
            </section>
          ) : (
            <section className="panel p-3">
              <div className="label mb-2">Colours</div>
              <PaletteGrid color={color} onPick={pickColor} layout="grid" />
              <div className="mt-3">
                <ColorExtras color={color} onPick={pickColor} hue={hue} setHue={setHue} />
              </div>
            </section>
          )}
        </aside>

        {/* bottom dock (phones) */}
        <div className="z-10 space-y-1.5 bg-white/85 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-2px_10px_rgba(43,35,80,0.08)] backdrop-blur md:hidden">
          {tool === 'sticker' ? (
            <StickerPicker sticker={sticker} setSticker={setSticker} layout="strip" />
          ) : (
            <PaletteGrid color={color} onPick={pickColor} layout="strip" />
          )}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {toolOptions}
            {tool !== 'sticker' && tool !== 'eraser' && <ColorExtras color={color} onPick={pickColor} hue={hue} setHue={setHue} compact />}
          </div>
          <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5" aria-label="Tools">
            {TOOLS.map((t) => (
              <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => setTool(t.id)} compact />
            ))}
          </nav>
        </div>
      </div>

      {/* dialogs */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Start again?">
        <p className="mb-5 text-ink/70">This clears all the colours and stickers so you get a fresh page. (You can still press Undo!)</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn bg-white py-3 shadow-pop-sm" onClick={() => setResetOpen(false)}>
            Keep it
          </button>
          <button
            className="btn bg-tangerine-500 py-3 text-white shadow-pop-sm"
            onClick={() => {
              eng?.reset();
              setResetOpen(false);
            }}
          >
            <RotateCcw size={20} /> Clear page
          </button>
        </div>
      </Modal>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="space-y-6">
          <div>
            <div className="label mb-2">Background</div>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  aria-pressed={theme === t.id}
                  className={`theme-${t.id} btn h-16 flex-col gap-0 text-sm ${theme === t.id ? 'ring-4 ring-grape-500' : 'shadow-pop-sm'} ${t.id === 'space' ? 'text-white' : ''}`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-1">Leak guard (fill tolerance): {gap}</div>
            <p className="mb-2 text-sm text-ink/60">If colour spills through a tiny gap in the lines, turn this up. Keep it low for small details.</p>
            <input type="range" min={0} max={8} value={gap} onChange={(e) => changeGap(Number(e.target.value))} className="slider w-full" aria-label="Leak guard" />
          </div>
          <Toggle
            on={!muted}
            setOn={(v) => {
              setMuted(!v);
              setMutedState(!v);
            }}
            label="Sounds"
            emoji="🔊"
          />
        </div>
      </Modal>

      <Modal open={celebrate} onClose={() => setCelebrate(false)}>
        <div className="text-center">
          <div className="text-6xl animate-wiggle" aria-hidden="true">🏆</div>
          <h2 className="mt-2 text-3xl font-bold text-grape-600">{praise}</h2>
          <p className="mt-1 text-ink/60">Your picture is saved in My Masterpieces.</p>
          {eng && <CelebrationPreview engine={eng} />}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn bg-grape-500 py-3 text-white shadow-pop-sm" onClick={doDownload}>
              <Download size={20} /> Download
            </button>
            <button className="btn bg-sky2-400 py-3 text-white shadow-pop-sm" onClick={doPrint}>
              <Printer size={20} /> Print
            </button>
            <button
              className="btn bg-mint-400 py-3 text-ink shadow-pop-sm"
              onClick={() => {
                setCelebrate(false);
                setTool('sticker');
              }}
            >
              ⭐ Add stickers
            </button>
            <button className="btn bg-sunny-400 py-3 text-ink shadow-pop-sm" onClick={() => navigate('/pages')}>
              🎨 New page
            </button>
          </div>
          <button className="btn mt-2 w-full py-2 text-ink/60" onClick={() => setCelebrate(false)}>
            Keep colouring
          </button>
        </div>
      </Modal>
      <Confetti run={confetti} />
    </div>
  );
}

function CelebrationPreview({ engine }: { engine: ColoringEngine }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    setSrc(engine.thumbnail(480).toDataURL('image/jpeg', 0.9));
  }, [engine]);
  return src ? <img src={src} alt="Your finished picture" className="mx-auto mt-4 h-52 w-52 rounded-2xl object-contain shadow-soft" /> : null;
}
