import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { navigate } from '../lib/router';
import type { Project } from '../lib/storage';

export function ContinueDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const [thumb, setThumb] = useState<string>();
  useEffect(() => {
    if (!project?.thumbnail) return;
    const u = URL.createObjectURL(project.thumbnail);
    setThumb(u);
    return () => URL.revokeObjectURL(u);
  }, [project]);
  if (!project) return null;
  const pageId = project.source.type === 'preset' ? project.source.pageId : '';
  return (
    <Modal open onClose={onClose} title="You've coloured this one before!">
      {thumb && <img src={thumb} alt="Your saved picture" className="mx-auto mb-5 h-48 w-48 rounded-2xl bg-white object-contain shadow-soft" />}
      <div className="grid gap-3">
        <button className="btn bg-grape-500 py-4 text-lg text-white shadow-pop" onClick={() => navigate(`/project/${project.id}`)}>
          🖍️ Keep colouring
        </button>
        <button className="btn bg-sunny-400 py-4 text-lg text-ink shadow-pop" onClick={() => navigate(`/color/${pageId}?fresh=1`)}>
          ✨ Start a fresh copy
        </button>
      </div>
    </Modal>
  );
}
