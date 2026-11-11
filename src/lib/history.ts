/**
 * Undo / redo history built from small rectangular patches, so memory stays
 * low even on large canvases: only the changed area is kept, before & after.
 */
export type LayerName = 'color' | 'sticker';

export interface Patch {
  layer: LayerName;
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
}

export interface HistoryEntry {
  patches: Patch[];
}

const MAX_ENTRIES = 60;
const MAX_BYTES = 220 * 1024 * 1024;

function entryBytes(e: HistoryEntry) {
  return e.patches.reduce((s, p) => s + p.before.data.length + p.after.data.length, 0);
}

export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private bytes = 0;

  push(entry: HistoryEntry) {
    if (!entry.patches.length) return;
    this.undoStack.push(entry);
    this.bytes += entryBytes(entry);
    for (const r of this.redoStack) this.bytes -= entryBytes(r);
    this.redoStack = [];
    while (this.undoStack.length > MAX_ENTRIES || (this.bytes > MAX_BYTES && this.undoStack.length > 1)) {
      const old = this.undoStack.shift()!;
      this.bytes -= entryBytes(old);
    }
  }

  undo(): HistoryEntry | undefined {
    const e = this.undoStack.pop();
    if (e) this.redoStack.push(e);
    return e;
  }

  redo(): HistoryEntry | undefined {
    const e = this.redoStack.pop();
    if (e) this.undoStack.push(e);
    return e;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
}
