import { Activity, Github } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full flex items-center justify-between px-6 py-3.5 bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-sm">
          <Activity size={18} strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-slate-900 tracking-tight text-lg">
          Site Url Scraper
        </span>
      </div>
      <a
        href="https://github.com/matakltm-code/site-url-scraper"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
        aria-label="GitHub Repository"
      >
        <Github size={22} fill="currentColor" strokeWidth={1} />
      </a>
    </header>
  );
}



