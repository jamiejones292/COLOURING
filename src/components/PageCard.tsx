import type { ColoringPage } from '../data/pages';
import { getCategory } from '../data/pages';
import { PageThumb } from './PageThumb';

export function PageCard({ page, onOpen, index = 0 }: { page: ColoringPage; onOpen: (p: ColoringPage) => void; index?: number }) {
  const cat = getCategory(page.category);
  return (
    <button
      onClick={() => onOpen(page)}
      className="group btn flex-col items-stretch gap-0 overflow-hidden rounded-3xl bg-white p-0 text-left shadow-pop hover:-translate-y-1 hover:shadow-[0_10px_0_0_rgba(43,35,80,0.15)] animate-popin"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      aria-label={`Colour ${page.title}`}
    >
      <div className="relative aspect-square w-full border-b-4 p-3" style={{ borderColor: (cat?.color ?? '#7c5cff') + '55' }}>
        <PageThumb svg={page.svg} alt="" />
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-xl" aria-hidden="true">{cat?.emoji}</span>
        <span className="truncate text-base font-semibold">{page.title}</span>
      </div>
    </button>
  );
}
