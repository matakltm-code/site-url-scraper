import { Activity, Github, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function Header() {
  const { t, i18n } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setIsLangMenuOpen(false);
  };

  const currentLang = i18n.language || 'en';

  return (
    <header className="w-full flex items-center justify-between px-6 py-3.5 bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-sm">
          <Activity size={18} strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-slate-900 tracking-tight text-lg">
          {t('header.title')}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Language Selector */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors py-1 px-2 rounded-md hover:bg-slate-100"
          >
            <span className="text-xl leading-none">
              {currentLang === 'am' ? '🇪🇹' : '🇺🇸'}
            </span>
            <span className="hidden md:block text-sm font-medium">
              {currentLang === 'am' ? 'Amharic' : 'English'}
            </span>
            <ChevronDown size={14} className={`transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isLangMenuOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
              <button 
                onClick={() => toggleLanguage('en')}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${currentLang === 'en' ? 'bg-slate-50 font-medium text-emerald-600' : 'text-slate-700'}`}
              >
                <span className="text-lg">🇺🇸</span> 
                <span className="hidden md:block">English</span>
                <span className="md:hidden">English</span>
              </button>
              <button 
                onClick={() => toggleLanguage('am')}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${currentLang === 'am' ? 'bg-slate-50 font-medium text-emerald-600' : 'text-slate-700'}`}
              >
                <span className="text-lg">🇪🇹</span> 
                <span className="hidden md:block">Amharic</span>
                <span className="md:hidden">Amharic</span>
              </button>
            </div>
          )}
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
      </div>
    </header>
  );
}



