# 🚀 Getting Started

This guide will walk you through setting up **Site URL Scraper** on your local machine for development or production deployment.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: Version `20.x` or higher
- **npm**: Version `10.x` or higher (or `bun` / `yarn`)
- **Git**: For version control

---

## 💻 Local Setup & Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/matakltm-code/site-url-scraper.git
   cd site-url-scraper
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

---

## 🛠 Running the Application

### Development Mode
Start the full-stack development server (Express server with integrated Vite middleware):

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Type Checking & Linting
Run TypeScript compiler check across the codebase:

```bash
npm run typecheck
# or
npm run lint
```

### Production Build & Server
To compile the frontend SPA and bundle the Express backend into production format (`dist/server.cjs`):

```bash
npm run build
npm start
```

---

## 📁 Directory Structure

```
site-url-scraper/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD workflows
├── docs/                   # Documentation files
├── dist/                   # Production build outputs (generated)
├── src/                    # Frontend React application
│   ├── components/         # React UI components
│   ├── App.tsx             # Main Dashboard entry component
│   ├── main.tsx            # React application entry
│   └── types.ts            # Shared TypeScript interface definitions
├── server.ts               # Backend Express + Puppeteer + SSE server
├── index.html              # Vite HTML entry point
├── package.json            # Dependencies and npm scripts
└── README.md               # Main project README
```
