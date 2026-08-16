import { useEffect, useState, useRef } from 'react';
import { Header } from './components/Header';
import { BrowserTerminal } from './components/BrowserTerminal';
import { DiscoveryTree } from './components/DiscoveryTree';
import { LiveLogger } from './components/LiveLogger';
import { DownloadPanel } from './components/DownloadPanel';
import { CrawlPhase, LogMessage, TreeNode } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Database, DownloadCloud, Pause, Play, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<CrawlPhase>('idle');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [mirrorStatus, setMirrorStatus] = useState<'running' | 'paused' | 'cancelled'>('running');
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Setup SSE connection scoped to activeJobId
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const sseUrl = activeJobId ? `/api/logs?jobId=${activeJobId}` : '/api/logs';
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      try {
        const log: LogMessage = JSON.parse(event.data);
        if (log.type === 'progress' && log.current !== undefined && log.total !== undefined) {
           setProgress({ current: log.current, total: log.total });
        }
        setLogs(prev => [...prev, log].slice(-100)); // Keep last 100 logs
      } catch (err) {
        console.error("Failed to parse log", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeJobId]);

  const generateJobId = () => `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const handleStartCrawl = async (url: string) => {
    const jobId = generateJobId();
    setActiveJobId(jobId);
    setLogs([]);
    setPhase('crawling');
    setTree(null);
    setSelectedIds(new Set());
    
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          jobId
        })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         console.warn("Received non-JSON response from server.");
         setLogs(prev => [...prev, {
           message: `[ERROR] Server returned non-JSON response (Status: ${res.status})`,
           type: 'error',
           timestamp: Date.now()
         }]);
         setPhase('error');
         return;
      }
      
      const data = await res.json();
      if (!res.ok) {
        setLogs(prev => [...prev, {
          message: `[ERROR] ${data.error || 'Crawl request failed'}`,
          type: 'error',
          timestamp: Date.now()
        }]);
        setPhase('error');
        return;
      }

      if (data.tree) {
        setTree(data.tree);
        setPhase('review');
        
        // Auto-select all by default
        const allIds = getAllIds(data.tree);
        setSelectedIds(new Set(allIds));
      } else {
        setPhase('error');
      }
    } catch (error: any) {
      console.error(error);
      setLogs(prev => [...prev, {
        message: `[ERROR] ${error.message || 'Crawl failed'}`,
        type: 'error',
        timestamp: Date.now()
      }]);
      setPhase('error');
    }
  };

  const handleToggleSelect = (targetId: string, descendantIds: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = descendantIds.every(id => next.has(id));
      
      if (allSelected) {
        descendantIds.forEach(id => next.delete(id));
      } else {
        descendantIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const getAllIds = (node: TreeNode): string[] => {
    let ids = [node.id];
    if (node.children) {
      node.children.forEach(child => {
        ids = ids.concat(getAllIds(child));
      });
    }
    return ids;
  };

  const handleStartMirror = async () => {
    if (selectedIds.size === 0) return;
    const jobId = generateJobId();
    setActiveJobId(jobId);
    
    setPhase('mirroring');
    setMirrorStatus('running');
    setProgress(null);
    
    try {
      const res = await fetch('/api/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedNodeIds: Array.from(selectedIds),
          jobId
        })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         console.warn("Received non-JSON response from server.");
         setPhase('review');
         return;
      }
      
      const data = await res.json();
      if (data.success) {
        setDownloadUrl(data.downloadUrl);
        setPhase('done');
        
        // Auto-trigger ZIP download in browser
        try {
          const downloadAnchor = document.createElement('a');
          downloadAnchor.href = data.downloadUrl;
          downloadAnchor.download = data.downloadUrl.split('/').pop() || 'mirror.zip';
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          document.body.removeChild(downloadAnchor);
        } catch (e) {
          console.error("Auto-download trigger failed:", e);
        }
      } else {
        setLogs(prev => [...prev, {
          message: `[ERROR] ${data.error || 'Mirroring failed'}`,
          type: 'error',
          timestamp: Date.now()
        }]);
        setPhase('review');
      }
    } catch (error: any) {
      console.error(error);
      setPhase('review');
    }
  };

  const handleControl = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!activeJobId) return;
    try {
      await fetch('/api/mirror/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJobId, action })
      });
      if (action === 'pause') setMirrorStatus('paused');
      if (action === 'resume') setMirrorStatus('running');
      if (action === 'cancel') {
        setPhase('review');
        setMirrorStatus('running');
        setProgress(null);
      }
    } catch(e) {}
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-900 relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/20 blur-[100px] rounded-full" />
      </div>

      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 flex flex-col items-center z-10">
        
        {/* Confirmation Modal */}
        <AnimatePresence>
          {isConfirming && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                 animate={{ opacity: 1, scale: 1, y: 0 }} 
                 className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100"
               >
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Extraction</h3>
                  <p className="text-slate-600 mb-8 leading-relaxed">
                    Are you sure you want to extract and bundle <strong className="text-slate-900">{selectedIds.size}</strong> links? This process may take a few moments.
                  </p>
                  <div className="flex justify-end gap-3">
                     <button 
                       onClick={() => setIsConfirming(false)} 
                       className="px-5 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                     >
                       Cancel
                     </button>
                     <button 
                       onClick={() => { setIsConfirming(false); handleStartMirror(); }} 
                       className="px-5 py-2.5 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
                     >
                       Confirm Export
                     </button>
                  </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div 
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center max-w-3xl mb-12"
            >
              <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                {t('hero.title_1')} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">
                  {t('hero.title_2')}
                </span>
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
                {t('hero.subtitle')}
              </p>
              
              <div className="flex items-center justify-center gap-4 mb-16">
                <button 
                  onClick={() => document.querySelector('input')?.focus()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Database size={18} />
                  {t('hero.start_crawling')}
                </button>
                <a 
                  href="https://github.com/matakltm-code/site-url-scraper#site-url-scraper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-8 py-3 rounded-full font-medium transition-all shadow-sm flex items-center gap-2"
                >
                  <DownloadCloud size={18} />
                  {t('hero.view_docs')}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Core Workspace */}
        <div className="w-full flex flex-col gap-8 max-w-5xl mx-auto">
          <motion.div 
            layout
            className="w-full"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          >
            <BrowserTerminal 
              onStart={handleStartCrawl} 
              disabled={phase === 'crawling' || phase === 'mirroring'} 
            />
          </motion.div>

          <AnimatePresence>
            {phase !== 'idle' && (
              <motion.div 
                key="workspace"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8"
              >
                
                {/* Left Column: Log Stream */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">{t('workspace.crawl_output')}</h3>
                    {phase !== 'crawling' && phase !== 'mirroring' && (
                      <button
                        onClick={() => {
                          setPhase('idle');
                          setLogs([]);
                          setTree(null);
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        {t('workspace.clear_reset')}
                      </button>
                    )}
                  </div>

                  <LiveLogger logs={logs} />
                  
                  {phase === 'error' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-red-800">{t('workspace.error_title')}</p>
                        <p className="text-sm text-red-600">{t('workspace.error_desc')}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setPhase('idle');
                          setLogs([]);
                          setTree(null);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                      >
                        {t('workspace.reset_terminal')}
                      </button>
                    </motion.div>
                  )}

                  {phase === 'review' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{t('workspace.ready_to_mirror')}</p>
                        <p className="text-sm text-slate-500">{t('workspace.nodes_selected', { count: selectedIds.size })}</p>
                      </div>
                      <button 
                        onClick={() => setIsConfirming(true)}
                        disabled={selectedIds.size === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                      >
                        {t('workspace.extract_bundle')}
                      </button>
                    </motion.div>
                  )}

                  {phase === 'mirroring' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between">
                         <div>
                           <p className="font-semibold text-slate-800">
                             {mirrorStatus === 'paused' ? t('workspace.mirroring_paused') : t('workspace.mirroring_in_progress')}
                           </p>
                           {progress && (
                             <p className="text-sm text-slate-500">
                               {t('workspace.captured', { current: progress.current, total: progress.total })}
                             </p>
                           )}
                         </div>
                         <div className="flex items-center gap-2">
                           {mirrorStatus === 'running' && (
                             <button onClick={() => handleControl('pause')} className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors" title="Pause">
                               <Pause size={18} fill="currentColor" />
                             </button>
                           )}
                           {mirrorStatus === 'paused' && (
                             <button onClick={() => handleControl('resume')} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors" title="Resume">
                               <Play size={18} fill="currentColor" />
                             </button>
                           )}
                           <button onClick={() => handleControl('cancel')} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" title="Cancel">
                             <XCircle size={18} />
                           </button>
                         </div>
                      </div>
                      
                      {/* Progress Bar */}
                      {progress && (
                         <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                           <div 
                             className={`h-full transition-all duration-300 ease-out ${mirrorStatus === 'paused' ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                             style={{ width: `${(progress.current / progress.total) * 100}%` }} 
                           />
                         </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Right Column: Tree View / Download */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-semibold text-slate-800">{t('workspace.resource_tree')}</h3>
                  
                  {phase === 'crawling' && !tree && (
                    <div className="h-[400px] bg-white border border-slate-200 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                      <p>{t('workspace.discovering')}</p>
                    </div>
                  )}

                  {phase === 'error' && (
                    <div className="h-[300px] bg-slate-50 border border-red-200 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-500 text-center p-6">
                      <p className="font-medium text-slate-700 mb-1">{t('workspace.discovery_stopped')}</p>
                      <p className="text-xs text-slate-500 max-w-xs">{t('workspace.discovery_stopped_desc')}</p>
                    </div>
                  )}

                  {tree && (phase === 'review' || phase === 'mirroring') && (
                    <DiscoveryTree 
                      tree={tree} 
                      selectedIds={selectedIds} 
                      onToggleSelect={handleToggleSelect} 
                    />
                  )}

                  {phase === 'done' && (
                    <DownloadPanel downloadUrl={downloadUrl} />
                  )}
                  
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>
    </div>
  );
}
