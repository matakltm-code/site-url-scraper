import { motion } from 'motion/react';
import { Download, CheckCircle2 } from 'lucide-react';

interface DownloadPanelProps {
  downloadUrl: string;
}

export function DownloadPanel({ downloadUrl }: DownloadPanelProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full bg-emerald-50 border border-emerald-100 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm"
    >
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4">
        <CheckCircle2 size={32} />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Mirror Bundle Ready</h3>
      <p className="text-gray-600 max-w-md mx-auto mb-2 text-sm">
        All selected documentation pages have been successfully mirrored, converted to Markdown, and bundled for offline browsing.
      </p>
      <p className="text-emerald-700 text-xs font-medium bg-emerald-100/80 px-3 py-1 rounded-full mb-6">
        Automatic ZIP download started. If it didn't launch automatically, click below:
      </p>
      
      <a 
        href={downloadUrl}
        download
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-full font-medium transition-all shadow-sm hover:shadow-md active:scale-95"
      >
        <Download size={18} />
        Download ZIP Archive
      </a>
    </motion.div>
  );
}
