import { useEffect, useState } from 'react';
import { Trash2, Brush, Download } from 'lucide-react';
import { BackBar } from '../components/BackBar';
import { Modal } from '../components/Modal';
import { deleteProject, listProjects, type Project } from '../lib/storage';
import { navigate } from '../lib/router';
import { safeName } from '../lib/exporter';

function useObjectUrl(b: Blob | null) {
  const [u, setU] = useState<string>();
  useEffect(() => {
    if (!b) return;
    const x = URL.createObjectURL(b);
    setU(x);
    return () => URL.revokeObjectURL(x);
  }, [b]);
  return u;
}

function Card({ p, onDelete }: { p: Project; onDelete: (p: Project) => void }) {
  const thumb = useObjectUrl(p.thumbnail);
  const download = () => {
    if (!thumb) return;
    // quick download of the preview; full-size export is in the workspace
    const a = document.createElement('a');
    a.href = thumb;
    a.download = `${safeName(p.name)}-preview.jpg`;
    a.click();
  };
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-pop animate-popin">
      <button className="relative aspect-square w-full p-2" onClick={() => navigate(`/project/${p.id}`)} aria-label={`Continue ${p.name}`}>
        {thumb ? <img src={thumb} alt={p.name} className="h-full w-full object-contain" /> : <div className="h-full w-full rounded-2xl bg-grape-50" />}
        {p.finished && <span className="absolute left-3 top-3 rounded-full bg-sunny-400 px-2.5 py-1 text-xs font-bold shadow-pop-sm">🏆 Finished</span>}
      </button>
      <div className="flex items-center gap-1 border-t-4 border-grape-100 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{p.name}</div>
          <div className="text-xs text-ink/50">{new Date(p.updatedAt).toLocaleDateString()}</div>
        </div>
        <button className="btn h-10 w-10 bg-grape-100 text-grape-700" onClick={() => navigate(`/project/${p.id}`)} aria-label="Keep colouring" title="Keep colouring">
          <Brush size={18} />
        </button>
        <button className="btn h-10 w-10 bg-sky2-300/50 text-ink" onClick={download} aria-label="Download preview" title="Download preview">
          <Download size={18} />
        </button>
        <button className="btn h-10 w-10 bg-bubble-300/40 text-bubble-500" onClick={() => onDelete(p)} aria-label="Delete" title="Delete">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

export function Masterpieces() {
  const [items, setItems] = useState<Project[] | null>(null);
  const [del, setDel] = useState<Project | null>(null);
  const load = () => listProjects().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="home-bg min-h-full">
      <BackBar title="🖼️ My Masterpieces" />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5">
        {items === null ? null : items.length === 0 ? (
          <div className="panel mx-auto max-w-md p-8 text-center">
            <div className="text-6xl animate-floaty">🎨</div>
            <h2 className="mt-3 text-2xl font-bold">No pictures yet!</h2>
            <p className="mt-1 text-ink/60">Everything you colour is saved here automatically.</p>
            <button className="btn mt-5 bg-grape-500 px-6 py-3.5 text-lg text-white shadow-pop" onClick={() => navigate('/pages')}>
              Start colouring
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <Card key={p.id} p={p} onDelete={setDel} />
            ))}
          </div>
        )}
        <p className="mt-10 text-center text-sm text-ink/50">Saved on this device only. Clearing your browser data will remove them.</p>
      </main>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this picture?">
        <p className="mb-5 text-ink/70">“{del?.name}” will be gone forever.</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn bg-white py-3 shadow-pop-sm" onClick={() => setDel(null)}>
            Keep it
          </button>
          <button
            className="btn bg-bubble-500 py-3 text-white shadow-pop-sm"
            onClick={async () => {
              if (del) await deleteProject(del.id).catch(() => {});
              setDel(null);
              void load();
            }}
          >
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
