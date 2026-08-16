# 🏗 Architecture Overview

**Site URL Scraper** is built as a full-stack Web application combining a reactive React SPA frontend with an Express + Stealth Puppeteer + SSE backend node engine.

---

## 🏛 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                │
│  - 100% Local Headless Execution Engine Badge           │
│  - BrowserTerminal (URL validation & input card)        │
│  - DiscoveryTree (Hierarchical tree selector)           │
│  - LiveLogger (Private SSE terminal feed & copy button) │
│  - Export Confirmation Dialog & Progress Bar            │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP / Isolated SSE
┌────────────────────────────▼────────────────────────────┐
│                  Express Backend (server.ts)            │
│  - SSRF Protection & express-rate-limit                 │
│  - GET /api/logs?jobId=... -> Isolated SSE Stream        │
│  - POST /api/crawl         -> Stealth Puppeteer Crawl   │
│  - POST /api/mirror        -> Offline Asset Mirroring    │
│  - POST /api/mirror/control-> Job Control (Pause/Cancel)│
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
              Local Stealth Puppeteer Context Pool
            (browser-level connection pooling & tab reuse)
```

---

## ⚙ Core Pipelines & Security Upgrades

### 1. Security & SSRF Protection
- **SSRF Validation**: Blocks access to cloud instance metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `.internal` routes, and `/computeMetadata/` requests) while allowing safe HTTP/HTTPS web targets and local testing.
- **Scoped Rate Limiting**: Endpoint rate limiters apply specifically to `/api/crawl` and `/api/mirror` to prevent flood attacks while leaving SSE log streams (`/api/logs`) unthrottled.

### 2. Local Stealth Engine & Browser Pooling
- **Local Headless Execution**: Reuses a shared master Chromium instance (`getLocalBrowser()`) with isolated browser contexts (`createBrowserContext()`), eliminating per-request process startup overhead and avoiding CPU spikes.
- **Stealth Evasion**: Utilizes `puppeteer-extra-plugin-stealth` with customized User-Agent spoofing (`Chrome/128`), viewport configuration (1920x1080), Sec-CH-UA headers, and `navigator.webdriver` removal to bypass anti-bot mechanisms without relying on paid cloud services.
- **Auto-Scrolling & Dynamic Expansion**: Executes time-bounded `window.scrollTo` loops until DOM height settles to trigger lazy-loaded links, and automatically expands collapsed navigation sidebars, menus, and accordions.
- **Resilient Timeout Handling**: Crawl and navigation promises gracefully catch network idle timeouts, logging warnings and extracting available DOM content rather than failing the job.

### 3. Job Isolation & Buffered SSE Logging (`/api/logs?jobId=...`)
- Employs an in-memory `activeJobs = new Map<string, ActiveJob>()` registry.
- SSE stream connections are bound to specific `jobId` keys (`jobSseClients = new Map<string, Set<Response>>`), ensuring users only receive terminal logs from their own crawling tasks.
- **Log Buffer Replay (`jobLogBuffers`)**: Retains early logs per job ID so that when the client's SSE EventSource connects, buffered events are replayed instantly with zero log loss.

### 4. Offline Mirroring, Markdown Conversion & Automatic Downloads
- Converts raw HTML into clean Markdown (`.md`) via **TurndownService**.
- Bundles HTML, Markdown, and static assets into high-efficiency ZIP archives (`ZipArchive`).
- **Automatic Client Download Trigger**: Once the server stream closes and returns the archive payload, the React frontend auto-clicks a synthetic anchor element to launch the `.zip` file download immediately.
- **Background ZIP Cleaner**: Runs automatically in the background, purging generated ZIP files in `/dist/downloads` older than 30 minutes.
