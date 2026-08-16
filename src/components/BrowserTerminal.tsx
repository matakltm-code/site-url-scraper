import { ArrowRight, ClipboardPaste, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, KeyboardEvent } from 'react';

interface BrowserTerminalProps {
  onStart: (url: string) => void;
  disabled: boolean;
}

export function BrowserTerminal({ onStart, disabled }: BrowserTerminalProps) {
  const [url, setUrl] = useState('');

  const validateUrl = (string: string) => {
    try {
      const parsed = new URL(string);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const isUrlValid = validateUrl(url.trim());
  const hasError = url.trim().length > 0 && !isUrlValid;
  const isSubmitDisabled = !url.trim() || disabled || !isUrlValid;

  const handleSubmit = () => {
    if (!isSubmitDisabled) {
      onStart(url.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className={`relative flex items-center shadow-lg rounded-2xl bg-white border p-2 transition-colors ${hasError ? 'border-red-400 focus-within:border-red-500 ring-1 ring-red-400/20' : 'border-gray-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20'}`}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="https://developer.ethiotelecom.et/docs/"
          className="w-full pl-6 pr-36 py-4 bg-transparent text-lg text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all disabled:opacity-50"
        />
        <div className="absolute right-4 flex items-center gap-1">
          {url && (
            <button
              onClick={() => setUrl('')}
              disabled={disabled}
              title="Clear input"
              className="w-10 h-10 hover:bg-gray-100 disabled:hover:bg-transparent rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                setUrl(text);
              } catch (e) {}
            }}
            disabled={disabled}
            title="Paste URL"
            className="w-10 h-10 hover:bg-gray-100 disabled:hover:bg-transparent rounded-full flex items-center justify-center text-gray-500 transition-colors disabled:opacity-50"
          >
            <ClipboardPaste size={18} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 rounded-full flex items-center justify-center text-white transition-colors shadow-sm disabled:cursor-not-allowed ml-1"
          >
            <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      {hasError ? (
        <p className="mt-4 text-sm text-red-500 text-center font-medium">
          Please enter a valid URL (e.g., https://example.com)
        </p>
      ) : (
        <p className="mt-4 text-sm text-gray-500 text-center">
          Enter a seed URL to initiate headless discovery.
        </p>
      )}
    </motion.div>
  );
}
