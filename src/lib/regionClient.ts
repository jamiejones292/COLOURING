import { computeRegions, type RegionResult } from './regions';

/**
 * Runs region detection in a Web Worker so the UI never freezes, with a
 * synchronous fallback for environments without module workers.
 */
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: RegionResult) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./regions.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data;
      const cb = pending.get(d.id);
      if (cb) {
        pending.delete(d.id);
        cb({ width: d.width, height: d.height, labels: d.labels, count: d.count, bboxes: d.bboxes, areas: d.areas });
      }
    };
    worker.onerror = () => {
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

export function detectRegions(ink: Uint8Array, width: number, height: number, gap: number, threshold = 128): Promise<RegionResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(computeRegions(ink, width, height, { gap, threshold }));
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const copy = ink.slice();
    w.postMessage({ id, ink: copy, width, height, gap, threshold }, [copy.buffer]);
  });
}
