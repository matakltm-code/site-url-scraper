import express from "express";
import path from "path";
import fs from "fs";
import dns from "dns";
import { promisify } from "util";
import { createServer as createViteServer } from "vite";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page, BrowserContext } from "puppeteer";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { createRequire } from "module";
import { ZipArchive } from "archiver";
import rateLimit from "express-rate-limit";

// Enable Puppeteer stealth plugin
puppeteerExtra.use(StealthPlugin());

const require = createRequire(import.meta.url);
const TurndownService = require("turndown");
const lookupAsync = promisify(dns.lookup);


// ==========================================
// 1. SSRF PROTECTION UTILITIES
// ==========================================
function isIpPrivate(ip: string): boolean {
  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  // IPv4 check
  if (ip.includes(".")) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 check
  const lower = ip.toLowerCase();
  if (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fe80:") ||
    lower.startsWith("fc00:") ||
    lower.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
}

async function isSsrfSafeUrl(urlString: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, reason: "Only HTTP and HTTPS protocols are allowed." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Strictly block GCP / Cloud Metadata Service endpoints
    if (
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal" ||
      hostname.endsWith(".internal") ||
      parsed.pathname.includes("/computeMetadata/")
    ) {
      return { safe: false, reason: "Access to cloud instance metadata endpoints is prohibited for security." };
    }

    // Allow local development & testing addresses
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return { safe: true };
    }

    // Resolve DNS for external hostnames to prevent private IP bypasses
    try {
      const addresses = await lookupAsync(hostname, { all: true });
      for (const addr of addresses) {
        if (isIpPrivate(addr.address)) {
          return { safe: false, reason: `Target domain resolves to a private IP address (${addr.address}).` };
        }
      }
    } catch (dnsErr: any) {
      return { safe: false, reason: `Failed to resolve domain name (${hostname}): ${dnsErr.message}` };
    }

    return { safe: true };
  } catch (err: any) {
    return { safe: false, reason: "Invalid URL format." };
  }
}

// ==========================================
// 2. TREE BUILDER HELPER
// ==========================================
function buildTree(urls: string[], baseUrl: string): any {
  const rootUrl = new URL(baseUrl);
  const rootNode = {
    id: rootUrl.origin + '/',
    label: rootUrl.hostname,
    type: 'domain',
    children: [] as any[]
  };

  const map = new Map<string, any>();
  map.set('', rootNode);

  const allUrls = Array.from(new Set([baseUrl, ...urls]));

  allUrls.forEach(u => {
    try {
      const parsed = new URL(u);
      if (parsed.origin !== rootUrl.origin) return;
      
      const segments = parsed.pathname.split('/').filter(Boolean);
      let currentPath = '';
      let parentNode = rootNode;

      for (let i = 0; i < segments.length; i++) {
        const isLeaf = i === segments.length - 1;
        const segment = segments[i];
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        
        if (!map.has(currentPath)) {
          const newNode: any = {
            id: parsed.origin + '/' + currentPath,
            label: segment,
            type: isLeaf ? 'page' : 'folder',
          };
          if (!isLeaf) {
            newNode.children = [];
          }
          map.set(currentPath, newNode);
          
          if (!parentNode.children) parentNode.children = [];
          parentNode.children.push(newNode);
        }
        
        parentNode = map.get(currentPath)!;
      }
      
      if (segments.length > 0) {
        parentNode.id = u;
      }
    } catch(e) {}
  });

  return rootNode;
}

// ==========================================
// 3. LOCAL PUPPETEER BROWSER POOL MANAGER
// ==========================================
let sharedLocalBrowser: any = null;

async function getLocalBrowser(): Promise<Browser> {
  if (sharedLocalBrowser && sharedLocalBrowser.connected) {
    return sharedLocalBrowser as unknown as Browser;
  }
  sharedLocalBrowser = await puppeteerExtra.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  sharedLocalBrowser.on('disconnected', () => {
    sharedLocalBrowser = null;
  });
  return sharedLocalBrowser as unknown as Browser;
}

interface BrowserSessionResult {
  browser: Browser;
  context: BrowserContext;
  close: () => Promise<void>;
}

async function acquireLocalBrowserSession(
  logFn?: (msg: string, type?: any, extra?: any) => void
): Promise<BrowserSessionResult> {
  if (logFn) logFn('[LOCAL] Reusing shared local Chromium browser pool context...', 'info');
  const masterBrowser = await getLocalBrowser();
  const context = await masterBrowser.createBrowserContext();
  
  return {
    browser: masterBrowser,
    context,
    close: async () => {
      try {
        await context.close();
      } catch (e) {}
    }
  };
}

// Configure stealth headers and spoofing per page
async function prepareStealthPage(page: Page) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  await page.setUserAgent(userAgent);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Sec-Ch-Ua': '"Chromium";v="128", "Not=A?Brand";v="24", "Google Chrome";v="128"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
}

// Local Feature: Auto-Scrolling & Sidebar Drawer Expander
async function autoScrollAndExpand(page: Page, logFn?: (msg: string, type?: any) => void) {
  if (logFn) logFn('[DOM] Auto-scrolling page (window.scrollTo) to trigger lazy-loaded dynamic content...', 'info');
  
  const scrollPromise = page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      let lastScrollHeight = 0;
      let sameHeightCount = 0;
      const distance = 400;

      const timer = setInterval(() => {
        const scrollHeight = document.body ? document.body.scrollHeight : 0;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (scrollHeight === lastScrollHeight) {
          sameHeightCount++;
        } else {
          sameHeightCount = 0;
          lastScrollHeight = scrollHeight;
        }

        if (sameHeightCount >= 4 || totalHeight >= 4000) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 120);
    });
  });

  // Limit auto-scroll duration to max 5 seconds
  await Promise.race([
    scrollPromise,
    new Promise(r => setTimeout(r, 5000))
  ]).catch(() => {});

  if (logFn) logFn('[DOM] Expanding dynamic navigation menus, sidebar categories, and accordions...', 'warning');
  
  const expandPromise = page.evaluate(async () => {
    const toggles = document.querySelectorAll(
      'button[aria-label*="navigation"], .navbar__toggle, .menu__button, button[aria-label*="menu"], button[aria-expanded="false"], [data-toggle="collapse"]'
    );
    toggles.forEach(btn => (btn as HTMLElement).click?.());
    
    await new Promise(r => setTimeout(r, 200));
    
    const collapsedItems = document.querySelectorAll(
      '.menu__list-item--collapsed, .theme-doc-sidebar-item-category, [aria-expanded="false"], details:not([open])'
    );
    collapsedItems.forEach(item => {
      if (item.tagName.toLowerCase() === 'details') {
        (item as HTMLDetailsElement).open = true;
      } else {
        const clickable = item.querySelector('a, button, .menu__link, summary') || item;
        if (clickable) (clickable as HTMLElement).click?.();
      }
    });
    
    await new Promise(r => setTimeout(r, 200));
  });

  // Limit expand duration to max 3 seconds
  await Promise.race([
    expandPromise,
    new Promise(r => setTimeout(r, 3000))
  ]).catch(() => {});
}

// ==========================================
// 4. JOB ISOLATION & PRIVATE SSE MAPS
// ==========================================
interface ActiveJob {
  id: string;
  type: 'crawl' | 'mirror';
  status: 'running' | 'paused' | 'cancelled';
  resume?: () => void;
  createdAt: number;
}

const activeJobs = new Map<string, ActiveJob>();
const jobSseClients = new Map<string, Set<express.Response>>();
const jobLogBuffers = new Map<string, Array<any>>();

function sendJobLog(
  jobId: string | undefined,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' | 'progress' = 'info',
  extra?: any
) {
  if (!jobId) return;
  const logObj = { message, type, timestamp: Date.now(), jobId, ...extra };

  if (!jobLogBuffers.has(jobId)) {
    jobLogBuffers.set(jobId, []);
  }
  const buffer = jobLogBuffers.get(jobId)!;
  buffer.push(logObj);
  if (buffer.length > 200) buffer.shift();

  const clients = jobSseClients.get(jobId);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify(logObj);
  clients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (e) {}
  });
}

// ==========================================
// 5. AUTOMATIC ZIP ARCHIVE CLEANUP TASK
// ==========================================
function startZipCleanupTask(downloadsDir: string) {
  const cleanup = () => {
    try {
      if (!fs.existsSync(downloadsDir)) return;
      const files = fs.readdirSync(downloadsDir);
      const now = Date.now();
      const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(downloadsDir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > MAX_AGE_MS) {
            fs.unlinkSync(filePath);
            console.log(`[CLEANUP] Deleted expired zip archive (${file})`);
          }
        }
      }
    } catch (e) {
      console.error('[CLEANUP ERROR]', e);
    }
  };

  cleanup();
  setInterval(cleanup, 30 * 60 * 1000); // Run every 30 minutes
}

// ==========================================
// 6. MAIN SERVER INSTANTIATION
// ==========================================
async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Enable trust proxy for reverse proxy environments (e.g., Cloud Run / Nginx)
  app.set('trust proxy', 1);

  app.use(express.json());

  // Rate limiters
  const taskLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Rate limit exceeded for crawl/mirror tasks." }
  });

  // Attach rate limiters to crawl & mirror routes
  app.use('/api/crawl', taskLimiter);
  app.use('/api/mirror', taskLimiter);

  // Serve static downloads
  const downloadsDir = path.join(process.cwd(), 'dist', 'downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
  
  app.use('/downloads', express.static(downloadsDir, {
    setHeaders: (res, path) => {
      if (path.endsWith('.zip')) {
        const filename = path.split('/').pop() || path.split('\\').pop();
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
    }
  }));

  // Start background zip cleaner
  startZipCleanupTask(downloadsDir);

  // SSE Log Stream per Job
  app.get('/api/logs', (req, res) => {
    const jobId = (req.query.jobId as string) || 'global';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    if (!jobSseClients.has(jobId)) {
      jobSseClients.set(jobId, new Set());
    }
    const clientsSet = jobSseClients.get(jobId)!;
    clientsSet.add(res);

    // Replay all buffered logs for this job so no events are lost
    const bufferedLogs = jobLogBuffers.get(jobId) || [];
    if (bufferedLogs.length > 0) {
      bufferedLogs.forEach(log => {
        try {
          res.write(`data: ${JSON.stringify(log)}\n\n`);
        } catch (e) {}
      });
    } else {
      res.write(`data: ${JSON.stringify({ message: 'Connected to Local Terminal Logger...', type: 'info', timestamp: Date.now(), jobId })}\n\n`);
    }

    req.on('close', () => {
      clientsSet.delete(res);
      if (clientsSet.size === 0) {
        jobSseClients.delete(jobId);
      }
    });
  });

  // Mirror Control Endpoint (Pause/Resume/Cancel)
  app.post('/api/mirror/control', (req, res) => {
    const { jobId, action } = req.body;
    if (!jobId || !activeJobs.has(jobId)) {
      return res.status(400).json({ error: 'No active job found for provided jobId' });
    }
    
    const job = activeJobs.get(jobId)!;
    
    if (action === 'pause') {
      job.status = 'paused';
      sendJobLog(jobId, '[PAUSED] Mirroring paused by user.', 'warning');
    } else if (action === 'resume') {
      job.status = 'running';
      if (job.resume) {
        job.resume();
        job.resume = undefined;
      }
      sendJobLog(jobId, '[RESUMED] Mirroring resumed.', 'success');
    } else if (action === 'cancel') {
      job.status = 'cancelled';
      if (job.resume) {
        job.resume();
        job.resume = undefined;
      }
      sendJobLog(jobId, '[CANCELLED] Mirroring cancelled by user.', 'error');
    }
    
    res.json({ success: true, status: job.status });
  });

  // Crawl Endpoint
  app.post('/api/crawl', taskLimiter, async (req, res) => {
    const { url, jobId } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const MAX_CONCURRENT_JOBS = 3;
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
      return res.status(429).json({ 
        error: `Server busy: maximum concurrent active jobs reached (${MAX_CONCURRENT_JOBS}). Please try again in a few moments.` 
      });
    }

    // SSRF Validation
    const ssrfCheck = await isSsrfSafeUrl(url);
    if (!ssrfCheck.safe) {
      sendJobLog(jobId, `[SECURITY ERROR] SSRF Protection blocked target: ${ssrfCheck.reason}`, 'error');
      return res.status(400).json({ error: `Security Error: ${ssrfCheck.reason}` });
    }

    const currentJobId = jobId || `job_${Date.now()}`;
    activeJobs.set(currentJobId, {
      id: currentJobId,
      type: 'crawl',
      status: 'running',
      createdAt: Date.now()
    });

    sendJobLog(currentJobId, `[INIT] Starting local deep discovery for target: ${url}`, 'info');

    let session: BrowserSessionResult | null = null;
    let page: Page | null = null;
    try {
      session = await acquireLocalBrowserSession(
        (msg, type, extra) => sendJobLog(currentJobId, msg, type, extra)
      );

      page = await session.context.newPage();
      await prepareStealthPage(page);

      sendJobLog(currentJobId, `[NETWORK] Navigating to target & waiting for page hydration...`, 'info');
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      } catch (navErr: any) {
        sendJobLog(currentJobId, `[NETWORK] Network idle wait timed out (${navErr.message}). Proceeding with current DOM content...`, 'warning');
      }

      // Dynamic Auto-scroll & Navigation expansion
      try {
        await autoScrollAndExpand(page, (msg, type) => sendJobLog(currentJobId, msg, type));
      } catch (scrollErr: any) {
        sendJobLog(currentJobId, `[DOM] Auto-scroll/expand warning: ${scrollErr.message}`, 'warning');
      }

      sendJobLog(currentJobId, `[DOM] Extracting recursive sidebar navigation tree...`, 'info');
      
      const hrefs = (await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => a.href);
      }).catch(() => [])) as string[];
      
      const parsedRoot = new URL(url);
      const uniqueHrefs = [...new Set(hrefs)].filter(h => {
        try {
          return new URL(h).origin === parsedRoot.origin;
        } catch (e) {
          return false;
        }
      });
      
      sendJobLog(currentJobId, `[PARSE] Extracted ${uniqueHrefs.length} potential routes within origin.`, 'success');
      
      const tree = buildTree(uniqueHrefs, url);
      
      sendJobLog(currentJobId, `[COMPLETE] Discovery phase finished.`, 'success');
      res.json({ tree, jobId: currentJobId });
    } catch (error: any) {
      sendJobLog(currentJobId, `[ERROR] Discovery failed: ${error.message}`, 'error');
      res.status(500).json({ error: error.message });
    } finally {
      activeJobs.delete(currentJobId);
      setTimeout(() => {
        jobLogBuffers.delete(currentJobId);
      }, 5 * 60 * 1000);
      if (page) {
        try { await page.close(); } catch(e) {}
      }
      if (session) {
        await session.close();
      }
    }
  });

  // Offline Mirror Endpoint
  app.post('/api/mirror', taskLimiter, async (req, res) => {
    const { selectedNodeIds, jobId } = req.body;
    
    if (!selectedNodeIds || !selectedNodeIds.length) {
      return res.status(400).json({ error: 'No URLs selected' });
    }

    const MAX_CONCURRENT_JOBS = 3;
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
      return res.status(429).json({ 
        error: `Server busy: maximum concurrent active jobs reached (${MAX_CONCURRENT_JOBS}). Please try again in a few moments.` 
      });
    }
    
    const urlsToScrape = selectedNodeIds.filter((id: string) => id.startsWith('http'));

    // SSRF Check first target
    const firstSsrf = await isSsrfSafeUrl(urlsToScrape[0]);
    if (!firstSsrf.safe) {
      return res.status(400).json({ error: `Security Error: ${firstSsrf.reason}` });
    }

    const currentJobId = jobId || `job_${Date.now()}`;
    const jobState: ActiveJob = {
      id: currentJobId,
      type: 'mirror',
      status: 'running',
      createdAt: Date.now()
    };
    activeJobs.set(currentJobId, jobState);

    sendJobLog(currentJobId, `[MIRROR] Initiating offline mirror for ${urlsToScrape.length} resources...`, 'warning');
    
    const firstUrl = new URL(urlsToScrape[0]);
    const domainSlug = firstUrl.hostname.replace(/\./g, '-');
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${yyyy}-${mm}-${dd}_${hh}${min}${ss}`;
    
    const zipName = `${domainSlug}_${timestamp}.zip`;
    const zipPath = path.join(downloadsDir, zipName);
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(output);
    
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    
    let session: BrowserSessionResult | null = null;
    try {
      session = await acquireLocalBrowserSession(
        (msg, type) => sendJobLog(currentJobId, msg, type)
      );

      const downloadedAssets = new Set<string>();
      
      for (let i = 0; i < urlsToScrape.length; i++) {
        // Handle Cancelled / Paused state
        if (jobState.status === 'cancelled') {
          sendJobLog(currentJobId, '[CANCELLED] Mirroring aborted before completion.', 'error');
          break;
        }
        if (jobState.status === 'paused') {
          await new Promise<void>(resolve => {
            jobState.resume = resolve;
          });
          if ((jobState.status as string) === 'cancelled') {
            sendJobLog(currentJobId, '[CANCELLED] Mirroring aborted before completion.', 'error');
            break;
          }
        }
        
        const pageUrl = urlsToScrape[i];

        // SSRF check per URL
        const pageSsrf = await isSsrfSafeUrl(pageUrl);
        if (!pageSsrf.safe) {
          sendJobLog(currentJobId, `[SECURITY SKIPPED] ${pageUrl}: ${pageSsrf.reason}`, 'warning');
          continue;
        }

        sendJobLog(
          currentJobId,
          `[MIRROR] Fetching [${i+1}/${urlsToScrape.length}]: ${pageUrl}`,
          'progress',
          { current: i + 1, total: urlsToScrape.length }
        );
        
        try {
          const page = await session.context.newPage();
          await prepareStealthPage(page);
          try {
            await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          } catch (navErr: any) {
            sendJobLog(currentJobId, `[NETWORK] Timeout waiting for network idle on ${pageUrl}. Proceeding with current DOM...`, 'warning');
          }
          
          let html = await page.content();
          const $ = cheerio.load(html);
          
          const parsedUrl = new URL(pageUrl);
          let filepath = parsedUrl.pathname;
          if (filepath.endsWith('/')) filepath += 'index';
          if (filepath.startsWith('/')) filepath = filepath.substring(1);
          if (!filepath) filepath = 'index';
          
          const depth = filepath.split('/').length - 1;
          const relPrefix = depth > 0 ? '../'.repeat(depth) : './';
          
          const processAsset = async (el: any, attr: string) => {
            const val = $(el).attr(attr);
            if (!val || val.startsWith('data:') || val.startsWith('#')) return;
            try {
              const assetUrl = new URL(val, pageUrl).href;
              const assetSsrf = await isSsrfSafeUrl(assetUrl);
              if (!assetSsrf.safe) return; // Skip unsafe internal asset targets

              const ext = path.extname(new URL(assetUrl).pathname) || '';
              const hash = crypto.createHash('md5').update(assetUrl).digest('hex').substring(0, 8);
              const filename = `${hash}${ext}`;
              const localPath = `assets/${filename}`;
              
              if (!downloadedAssets.has(assetUrl)) {
                downloadedAssets.add(assetUrl);
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sec timeout per asset
                  const resp = await fetch(assetUrl, { signal: controller.signal });
                  clearTimeout(timeoutId);

                  if (resp.ok) {
                    const contentLength = resp.headers.get('content-length');
                    const MAX_ASSET_BYTES = 15 * 1024 * 1024; // 15MB limit per asset
                    if (contentLength && parseInt(contentLength, 10) > MAX_ASSET_BYTES) {
                      return;
                    }
                    const arrayBuf = await resp.arrayBuffer();
                    if (arrayBuf.byteLength <= MAX_ASSET_BYTES) {
                      const buf = Buffer.from(arrayBuf);
                      archive.append(buf, { name: localPath });
                    }
                  }
                } catch(e) {}
              }
              $(el).attr(attr, `${relPrefix}${localPath}`);
            } catch(e) {}
          };
          
          const links = $('link[rel="stylesheet"]').toArray();
          for (const el of links) await processAsset(el, 'href');
          
          const scripts = $('script[src]').toArray();
          for (const el of scripts) await processAsset(el, 'src');
          
          const images = $('img[src]').toArray();
          for (const el of images) await processAsset(el, 'src');
          
          // Rewrite internal links
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href || href.startsWith('data:') || href.startsWith('#') || href.startsWith('mailto:')) return;
            try {
              const targetUrl = new URL(href, pageUrl);
              if (targetUrl.origin === parsedUrl.origin) {
                let targetPath = targetUrl.pathname;
                if (targetPath.endsWith('/')) targetPath += 'index';
                if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);
                if (!targetPath) targetPath = 'index';
                targetPath += '.html';
                $(el).attr('href', `${relPrefix}${targetPath}${targetUrl.hash}`);
              }
            } catch(e) {}
          });
          
          html = $.html();
          
          let markdown = '';
          try {
            markdown = turndownService.turndown(html);
          } catch(e) {
            markdown = 'Markdown conversion failed.';
          }
          
          archive.append(html, { name: `${filepath}.html` });
          archive.append(markdown, { name: `${filepath}.md` });
          
          await page.close();
          sendJobLog(currentJobId, `[SUCCESS] Captured ${filepath}`, 'success');
        } catch (err: any) {
          sendJobLog(currentJobId, `[ERROR] Failed to capture ${pageUrl}: ${err.message}`, 'error');
        }
      }
      
      if (jobState.status === 'cancelled') {
        archive.abort();
        return res.status(400).json({ error: 'Job cancelled' });
      }

      sendJobLog(currentJobId, `[MIRROR] Bundling assets into ZIP archive...`, 'warning');
      await new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.finalize().catch(reject);
      });
      sendJobLog(currentJobId, `[SUCCESS] Offline mirror bundle ready for download.`, 'success');

      res.json({
        success: true,
        downloadUrl: `/downloads/${zipName}`,
        jobId: currentJobId
      });
    } catch (error: any) {
      sendJobLog(currentJobId, `[ERROR] Mirroring failed: ${error.message}`, 'error');
      res.status(500).json({ error: error.message });
    } finally {
      activeJobs.delete(currentJobId);
      setTimeout(() => {
        jobLogBuffers.delete(currentJobId);
      }, 5 * 60 * 1000);
      if (session) {
        await session.close();
      }
    }
  });

  // Vite middleware / SPA fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Express Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[UNHANDLED EXPRESS ERROR]', err);
    res.status(500).json({ error: err.message || 'Internal server error occurred.' });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
