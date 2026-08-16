# Site URL Scraper

> Fast, modern, 100% self-hosted local site crawler, recursive link discoverer, and offline web content packager.

[![CI Workflow](https://github.com/matakltm-code/site-url-scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/matakltm-code/site-url-scraper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-20.x+-blue.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

---

## ✨ Features

- 🕷 **100% Local Headless URL Discovery**: Crawl sites recursively using local Puppeteer with stealth anti-bot protection and Cheerio.
- 🥷 **Built-In Stealth & Anti-Bot**: Automatic User-Agent spoofing, Sec-CH-UA headers, viewport matching, and `puppeteer-extra-plugin-stealth` integration.
- 📜 **Infinite Scrolling & Navigation Expansion**: Automatic `window.scrollTo` loops and sidebar accordion/drawer expansion to capture dynamic SPAs and lazy-loaded routes.
- 🌳 **Interactive Tree Visualizer**: Filter discovered pages, folders, and domains with bulk node selection and metric counts.
- 📺 **Buffered Real-Time SSE Terminal**: Monitor live crawl and extraction events streamed via Server-Sent Events with log replay buffering and timestamped log copying.
- 📦 **Markdown & ZIP Packaging**: Extract web pages, convert HTML to clean Markdown using Turndown, and automatically trigger compressed `.zip` archive downloads in the browser.
- 🏷 **Dynamic Domain-Timestamp Naming**: Download files formatted like `<domain-slug>_<YYYY-MM-DD_HHmmss>.zip` with forced `Content-Disposition` attachment headers.
- ⏸ **Interactive Mirror Controls**: Pause, Resume, or Cancel active extraction pipelines safely with live progress bar tracking.
- 🛡 **Real-Time Security**: Built-in SSRF protection blocking local/private endpoint calls and rate limiting.

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
