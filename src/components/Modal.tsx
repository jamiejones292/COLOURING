import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel relative max-h-[92dvh] w-full overflow-y-auto p-6 animate-popin ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="btn-icon absolute right-3 top-3 h-10 w-10" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        {title && <h2 className="mb-4 pr-10 text-2xl font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
