# Site URL Scraper

> Fast, modern, 100% self-hosted local site crawler, recursive link discoverer, and offline web content packager.

[![CI Workflow](https://github.com/matakltm-code/site-url-scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/matakltm-code/site-url-scraper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-20.x+-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

---

## ✨ Features

- 🕷 **Deep URL Discovery & Crawling**: Crawls sites recursively using local headless Puppeteer and Cheerio.
- 🥷 **Stealth & Anti-Bot Protection**: Automatic User-Agent spoofing, viewport matching, and `puppeteer-extra-plugin-stealth` to bypass basic bot detections.
- 📜 **Dynamic SPA Support**: Handles infinite scrolling, lazy-loaded routes, and sidebar accordion expansions to capture hidden content.
- 🌳 **Interactive Resource Tree**: Visualizes discovered pages and folders. Select or deselect specific nodes to customize your extraction.
- 📦 **Offline Mirroring & Markdown Export**: Converts HTML to clean Markdown (via Turndown) and automatically bundles everything into a downloadable `.zip` archive.
- 📺 **Real-Time Live Terminal**: Streams live crawl events and logs directly to the UI via Server-Sent Events (SSE).
- ⏸ **Job Controls (Pause/Resume/Cancel)**: Full interactive control over the active extraction pipeline with real-time progress bars.
- 🌍 **Multi-Language Support (i18n)**: Seamlessly switch between English (🇺🇸) and Amharic (🇪🇹) with a built-in language selector.
- 🛡 **Enterprise-Grade Security**: Built-in SSRF protection blocks local/private IP bypassing and enforces rate limiting.

---

## 🚀 Quick Start

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher

### Installation & Execution

```bash
# 1. Clone repository
git clone https://github.com/matakltm-code/site-url-scraper.git
cd site-url-scraper

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📚 Documentation

Detailed documentation is available in the [`/docs`](./docs) folder:

- 🚀 [**Getting Started Guide**](./docs/getting-started.md)
- 🏗 [**Architecture & System Design**](./docs/architecture.md)
- 🔌 [**API Reference**](./docs/api-reference.md)
- 🤝 [**Contributing Guidelines**](./docs/contributing.md)
- 📜 [**Changelog**](./CHANGELOG.md)

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Motion
- **Backend**: Node.js, Express, Puppeteer Extra (Stealth Plugin), Cheerio, Turndown, Archiver

---

## 📄 License

Distributed under the MIT License.
