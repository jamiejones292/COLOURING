/// <reference lib="webworker" />
import { computeRegions } from './regions';

interface Req {
  id: number;
  ink: Uint8Array;
  width: number;
  height: number;
  gap: number;
  threshold: number;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, ink, width, height, gap, threshold } = e.data;
  const r = computeRegions(ink, width, height, { gap, threshold });
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(
    { id, labels: r.labels, count: r.count, bboxes: r.bboxes, areas: r.areas, width, height },
    [r.labels.buffer, r.bboxes.buffer, r.areas.buffer],
  );
};
