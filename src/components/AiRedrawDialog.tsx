import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { aiRedraw, AiError } from '../lib/aiRedraw';
import { getPref, setPref } from '../lib/prefs';

const STEPS = ['Mixing the magic paint…', 'Sharpening the pencils…', 'Tracing the lines…', 'Closing all the gaps…', 'Tidying up the edges…', 'Almost there…'];

type Phase = 'ask' | 'working' | 'error';

export function AiRedrawDialog({
  open, onClose, source, passcodeRequired, onResult,
}: {
  open: boolean;
  onClose: () => void;
  source: HTMLCanvasElement;
  passcodeRequired: boolean;
  onResult: (dataUrl: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('ask');
  const [error, setError] = useState('');
  const [passcode, setPasscode] = useState(() => getPref('aiPasscode', ''));
  const [step, setStep] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setPhase('ask');
      setError('');
    }
    return () => abort.current?.abort();
  }, [open]);

  useEffect(() => {
    if (phase !== 'working') return;
    setStep(0);
    const t = window.setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 7000);
    return () => window.clearInterval(t);
  }, [phase]);

  const start = async () => {
    abort.current = new AbortController();
    setPhase('working');
    try {
      const url = await aiRedraw(source, passcodeRequired ? passcode.trim() : undefined, abort.current.signal);
      if (passcodeRequired) setPref('aiPasscode', passcode.trim());
      onResult(url);
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('Something went wrong.');
      if (err.code === 'cancelled') return;
      if (err.code === 'passcode') setPref('aiPasscode', '');
      setError(err.message);
      setPhase('error');
    }
  };

  const cancel = () => {
    abort.current?.abort();
    onClose();
  };

  return (
    <Modal open={open} onClose={cancel} title={phase === 'working' ? undefined : '✨ AI Magic Redraw'}>
      {phase === 'working' ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center" role="status" aria-live="polite">
          <div className="relative">
            <div className="text-7xl animate-wiggle" aria-hidden="true">🪄</div>
            <Sparkles className="absolute -right-4 -top-2 animate-pulse text-sunny-500" size={28} />
          </div>
          <p className="text-2xl font-bold text-grape-600">{STEPS[step]}</p>
          <p className="text-ink/60">The magic takes about a minute. Don&apos;t close this page!</p>
          <Loader2 className="animate-spin text-grape-500" size={32} />
          <button className="btn mt-2 bg-white px-5 py-2.5 shadow-pop-sm" onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-ink/80">
            AI will redraw this picture as a clean colouring page with thick, closed lines, so the colours stay perfectly inside.
          </p>
          <div className="rounded-2xl bg-sunny-300/50 p-3 text-sm">
            <b>👋 Grown-ups:</b> this sends the picture over the internet to OpenAI to be redrawn. It isn&apos;t kept by Paintpot Pals. Please avoid photos showing children&apos;s faces, names or other personal details.
          </div>
          {passcodeRequired && (
            <label className="block">
              <div className="label mb-1">Grown-up passcode</div>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="off"
                className="w-full rounded-xl border-2 border-grape-100 px-3 py-2 text-lg focus:border-grape-400 focus:outline-none"
              />
            </label>
          )}
          {phase === 'error' && <p className="rounded-2xl bg-bubble-300/40 px-4 py-2 font-semibold text-bubble-500">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn bg-white py-3 shadow-pop-sm" onClick={onClose}>
              Not now
            </button>
            <button className="btn bg-grape-500 py-3 text-white shadow-pop-sm" onClick={start} disabled={passcodeRequired && !passcode.trim()}>
              <Sparkles size={20} /> {phase === 'error' ? 'Try again' : 'Do the magic!'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
