import { useEffect, useState } from 'react';
import { Upload as UploadIcon, Images, Sparkles } from 'lucide-react';
import { Logo } from '../components/Logo';
import { PageCard } from '../components/PageCard';
import { ContinueDialog } from '../components/ContinueDialog';
import { CATEGORIES, PAGES } from '../data/pages';
import { navigate } from '../lib/router';
import { openPage } from '../lib/openPage';
import { listProjects, type Project } from '../lib/storage';

const FEATURED = ['unicorn', 'puppy-party', 'trex', 'elf-waving', 'rocket', 'angel-heart', 'lion', 'elephant-flower'];

export function Home() {
  const [ask, setAsk] = useState<Project | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    listProjects().then((l) => setSavedCount(l.length)).catch(() => {});
  }, []);
  const featured = FEATURED.map((id) => PAGES.find((p) => p.id === id)!).filter(Boolean);

  return (
    <div className="home-bg min-h-full">
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
        <section className="relative flex flex-col items-center text-center">
          <div className="pointer-events-none absolute -left-2 top-4 hidden text-6xl animate-floaty sm:block" aria-hidden="true">🖍️</div>
          <div className="pointer-events-none absolute right-0 top-0 hidden text-6xl animate-floaty sm:block" style={{ animationDelay: '1s' }} aria-hidden="true">🎨</div>
          <h1 className="sr-only">Paintpot Pals – the magic colouring book</h1>
          <Logo big />
          <p className="mt-5 max-w-xl text-lg text-ink/70 sm:text-xl">
            The magic colouring book where your colours <b className="text-grape-600">always stay inside the lines</b>. Tap to fill, paint with sparkly brushes, or colour your very own drawings!
          </p>
          <button
            onClick={() => navigate('/pages')}
            className="btn mt-8 bg-grape-500 px-10 py-5 text-2xl text-white shadow-[0_8px_0_0_#5531cc] hover:bg-grape-600 active:translate-y-[6px] active:shadow-[0_2px_0_0_#5531cc] sm:text-3xl"
          >
            <Sparkles size={32} /> Start Colouring!
          </button>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => navigate('/upload')} className="btn bg-sunny-400 px-6 py-3.5 text-lg text-ink shadow-pop hover:bg-sunny-300">
              <UploadIcon size={22} /> Colour my own picture
            </button>
            <button onClick={() => navigate('/masterpieces')} className="btn bg-bubble-400 px-6 py-3.5 text-lg text-white shadow-pop hover:bg-bubble-500">
              <Images size={22} /> My Masterpieces{savedCount ? ` (${savedCount})` : ''}
            </button>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Pick a page to colour ✏️</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p, i) => (
              <PageCard key={p.id} page={p} index={i} onOpen={(pg) => openPage(pg.id, setAsk)} />
            ))}
          </div>
          <div className="mt-6 text-center">
            <button onClick={() => navigate('/pages')} className="btn bg-white px-6 py-3 text-lg shadow-pop">
              See all {PAGES.length} pages →
            </button>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Explore by theme 🌈</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/pages/${c.id}`)}
                className="btn flex-col gap-1 rounded-3xl py-5 text-white shadow-pop hover:-translate-y-1"
                style={{ background: c.color }}
              >
                <span className="text-4xl" aria-hidden="true">{c.emoji}</span>
                <span className="text-base font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">{c.name}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="mt-16 text-center text-sm text-ink/50">
          No ads · No accounts · Pictures stay on your device 💜
        </footer>
      </main>
      <ContinueDialog project={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
