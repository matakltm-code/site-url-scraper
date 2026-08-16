import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LogMessage } from '../types';
import { Copy, Check, Download } from 'lucide-react';

interface LiveLoggerProps {
  logs: LogMessage[];
}

export function LiveLogger({ logs }: LiveLoggerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = async () => {
    try {
      const text = logs.map(l => `[${new Date(l.timestamp).toISOString().split('T')[1].slice(0, 8)}] ${l.message}`).join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy logs", e);
    }
  };

  const handleDownloadLogs = () => {
    try {
      const text = logs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crawl_logs_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download logs", e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-950">
        <span className="text-xs font-mono text-gray-500">Terminal Logger</span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 text-xs"
            title="Copy logs to clipboard"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? <span className="text-emerald-400">Copied</span> : <span>Copy</span>}
          </button>
          <button
            onClick={handleDownloadLogs}
            className="text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 text-xs"
            title="Export logs as text file"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="p-4 h-[250px] overflow-y-auto font-mono text-sm space-y-1.5"
      >
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-gray-500 flex-shrink-0">
              {new Date(log.timestamp).toISOString().split('T')[1].slice(0, 8)}
            </span>
            <span className={
              log.type === 'info' ? 'text-blue-300' :
              log.type === 'success' ? 'text-emerald-400' :
              log.type === 'warning' ? 'text-amber-300' :
              'text-red-400'
            }>
              {log.message.includes('https://') ? (
                <>
                  {log.message.split(/(https:\/\/[^\s]+)/g).map((part, idx) => 
                    part.startsWith('https://') ? (
                      <a
                        key={idx}
                        href={part}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-sky-300 transition-colors font-medium ml-1"
                      >
                        {part}
                      </a>
                    ) : part
                  )}
                </>
              ) : (
                log.message
              )}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-gray-600 italic">Awaiting connection...</div>
        )}
      </div>
    </motion.div>
  );
}
