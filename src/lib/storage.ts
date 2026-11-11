/**
 * Tiny IndexedDB wrapper — projects are saved only on this device.
 * No accounts, no servers, no personal information.
 */

export type ProjectSource =
  | { type: 'preset'; pageId: string }
  | { type: 'upload'; lineArt: Blob; width: number; height: number };

export interface Project {
  id: string;
  name: string;
  source: ProjectSource;
  gap: number;
  colorLayer: Blob | null;
  stickerLayer: Blob | null;
  thumbnail: Blob | null;
  finished: boolean;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'paintpot-pals';
const STORE = 'projects';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Saving is not available in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** In-memory fallback for browsers that block IndexedDB (e.g. some private modes). */
const memory = new Map<string, Project>();

export async function saveProject(p: Project): Promise<Project> {
  memory.set(p.id, p);
  await tx('readwrite', (s) => s.put(p));
  return p;
}

export async function getProject(id: string): Promise<Project | undefined> {
  try {
    return (await tx<Project | undefined>('readonly', (s) => s.get(id))) ?? memory.get(id);
  } catch {
    return memory.get(id);
  }
}

export async function deleteProject(id: string): Promise<void> {
  memory.delete(id);
  await tx('readwrite', (s) => s.delete(id));
}

export async function listProjects(): Promise<Project[]> {
  let all: Project[];
  try {
    all = await tx<Project[]>('readonly', (s) => s.getAll());
  } catch {
    all = [...memory.values()];
  }
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Most recent unfinished-or-not project for a preset page, if any. */
export async function findProjectForPage(pageId: string): Promise<Project | undefined> {
  const all = await listProjects();
  return all.find((p) => p.source.type === 'preset' && p.source.pageId === pageId);
}

/** Ask the browser to keep our data (best effort). */
export function requestPersistence() {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}
