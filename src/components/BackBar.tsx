import type { ReactNode } from 'react';
import { Home as HomeIcon } from 'lucide-react';
import { navigate } from '../lib/router';

export function BackBar({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/5 bg-[#fff7e8]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button className="btn-icon h-12 w-12" onClick={() => navigate('/')} aria-label="Home">
          <HomeIcon size={24} />
        </button>
        <h1 className="flex-1 truncate text-2xl font-bold sm:text-3xl">{title}</h1>
        {right}
      </div>
    </header>
  );
}
