# Changelog

All notable changes to the **Site URL Scraper** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Docker containerization setup for simplified deployment.
- Option to export crawled metadata into JSON / CSV format.
- Multi-threaded headless crawl concurrency controls.

---

## [1.0.2] - 2026-08-12

### Added & Enhanced
- **Asynchronous DNS SSRF Protection**: Enhanced `isSsrfSafeUrl` with `dns.lookup` resolution to inspect resolved IP addresses against `isIpPrivate`, preventing DNS rebinding and SSRF bypass attempts on external targets while preserving local testing capabilities (`localhost` / `127.0.0.1`).
- **Concurrent Job Capacity Guard**: Enforced a `MAX_CONCURRENT_JOBS` limit (3 jobs max) on `/api/crawl` and `/api/mirror` endpoints to protect host RAM and CPU from parallel headless browser exhaustion.
- **Log Buffer Memory Reclaim**: Configured automatic scheduled cleanup of `jobLogBuffers` in job `finally` handlers to prevent Map memory leaks across long server uptimes.
- **Asset Download Timeout & Size Guard**: Implemented an 8-second `AbortController` fetch timeout and a 15MB file size limit per asset during offline mirroring to prevent stuck connections and heap memory crashes.
- **Terminal Log Export (`LiveLogger`)**: Added a **Download / Export** button next to the copy control to export terminal logs as a timestamped `.txt` file.
- **Resource Search Filter (`DiscoveryTree`)**: Added an inline search filter input in the resource tree panel to quickly locate and highlight routes on large crawled sites.
- **Dependency Optimization**: Removed unused `@google/genai` dependency from `package.json` and lockfile.

---

## [1.0.1] - 2026-08-12

### Fixed & Improved
- **Automatic ZIP Download**: Configured client-side auto-trigger (`<a>` element click) when mirror job completes, immediately initiating file download upon completion.
- **SSE Log Buffering**: Introduced server-side `jobLogBuffers` replay mechanism so early logs published before client EventSource handshake are preserved and streamed seamlessly upon connection.
- **Resilient Navigation & Timeout Recovery**: Gracefully catches `networkidle` navigation timeouts during Puppeteer crawls and auto-scrolls, logging warnings and continuing DOM processing without crashing jobs.
- **Terminal Error Retention**: Added an explicit `'error'` state to the frontend workspace layout, keeping terminal logs visible on failure with a manual **Reset Terminal** button.
- **SSRF Policy Refinement**: Refined SSRF security filters in `server.ts` to allow local app/container routes (`http://localhost:3000`) while maintaining strict cloud metadata protection (`169.254.169.254`, `metadata.google.internal`).
- **Scoped Rate Limiting**: Excluded Server-Sent Event stream connections (`/api/logs`) from global rate limiters to prevent long-running tasks from triggering `429 Too Many Requests`.
- **Express Error Handler**: Added global error handling middleware in Express to ensure all server errors return formatted JSON payloads (`{ error: ... }`).

---

## [1.0.0] - 2026-08-12

### Added
- **Headless Discovery Engine**: Integrated Puppeteer and Cheerio for recursive URL discovery with customizable crawl depth.
- **Interactive Tree Hierarchy (`DiscoveryTree`)**: Rendered domain, folder, and page nodes with bulk node selection/deselection and node count metrics.
- **Real-Time Terminal Logger (`LiveLogger`)**: Built Server-Sent Events (SSE) streaming logger endpoint (`/api/logs`) with log color coding and inline copy-to-clipboard button.
- **Offline Mirror & Markdown Converter**: Endpoint (`/api/mirror`) for downloading assets and generating Markdown documentation using Turndown and Archiver.
- **Unique Zip Naming & Headers**: Automatic dynamic zip filename generation (`<domain-slug>_<YYYY-MM-DD_HHmmss>.zip`) and `Content-Disposition: attachment` download response headers.
- **Interactive Mirroring Controls**: Implemented backend job control (`/api/mirror/control`) for Pausing, Resuming, and Cancelling active mirror operations safely.
- **Live Progress Tracking**: Progress bar and node count indicators during the extraction and bundling process.
- **Confirmation Dialog**: Modal confirmation popup before starting the export and bundling task.
- **Real-time URL Validation**: Client-side validation with instant error messages, clear input button, and reactive action button disabling.
- **GitHub Actions CI/CD Workflows**: Added `.github/workflows/ci.yml` for linting, typechecking, and build checks, and `.github/workflows/release.yml` for automated releases on tag pushes.
- **Documentation**: Added comprehensive project documentation under `/docs/` covering getting started, architecture, API reference, and contribution guidelines.
