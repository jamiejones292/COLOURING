import { useState } from 'react';
import { BackBar } from '../components/BackBar';
import { PageCard } from '../components/PageCard';
import { ContinueDialog } from '../components/ContinueDialog';
import { CATEGORIES, PAGES } from '../data/pages';
import { navigate } from '../lib/router';
import { openPage } from '../lib/openPage';
import type { Project } from '../lib/storage';

export function Gallery({ category }: { category?: string }) {
  const [ask, setAsk] = useState<Project | null>(null);
  const pages = category ? PAGES.filter((p) => p.category === category) : PAGES;
  const cat = CATEGORIES.find((c) => c.id === category);
  return (
    <div className="home-bg min-h-full">
      <BackBar
        title={cat ? `${cat.emoji} ${cat.name}` : '🎨 Colouring Pages'}
        right={
          <button className="btn bg-sunny-400 px-4 py-3 text-ink shadow-pop-sm" onClick={() => navigate('/upload')}>
            📷 <span className="hidden sm:inline">My own picture</span>
          </button>
        }
      />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-4" aria-label="Themes">
          <button className={`chip shrink-0 ${!category ? '!bg-grape-500 text-white' : ''}`} onClick={() => navigate('/pages', true)}>
            ⭐ All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className="chip shrink-0"
              style={category === c.id ? { background: c.color, color: '#fff' } : undefined}
              onClick={() => navigate(`/pages/${c.id}`, true)}
              aria-pressed={category === c.id}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.name}
            </button>
          ))}
        </nav>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {pages.map((p, i) => (
            <PageCard key={p.id} page={p} index={i} onOpen={(pg) => openPage(pg.id, setAsk)} />
          ))}
        </div>
      </div>
      <ContinueDialog project={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
