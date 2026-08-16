# 🔌 API Reference

This document outlines the REST and Event Stream API endpoints provided by the **Site URL Scraper** backend service (`server.ts`).

---

## 1. Start Crawling
Initiates local headless link discovery starting from a seed URL. Protected by SSRF validation and rate-limiting.

- **Endpoint**: `POST /api/crawl`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "url": "https://developer.example.com/docs/",
    "jobId": "job_1786559038_abc12"
  }
  ```
- **Response**:
  ```json
  {
    "tree": {
      "id": "https://developer.example.com",
      "label": "developer.example.com",
      "type": "domain",
      "children": [ ... ]
    },
    "jobId": "job_1786559038_abc12"
  }
  ```

---

## 2. Isolated Live Log Event Stream
Subscribe to real-time crawler and mirroring logs for a specific job using Server-Sent Events (SSE). Replays early buffered logs automatically upon client connection.

- **Endpoint**: `GET /api/logs?jobId=job_1786559038_abc12`
- **Headers**: `Accept: text/event-stream`
- **Event Stream Payload**:
  ```json
  {
    "message": "[MIRROR] Fetching [3/12]: https://example.com/docs/page",
    "type": "progress",
    "timestamp": 1786559038879,
    "jobId": "job_1786559038_abc12",
    "current": 3,
    "total": 12
  }
  ```

---

## 3. Extract & Mirror Selected Links
Triggers local headless scraping and Markdown bundling for selected URL nodes. On completion, the frontend auto-launches the `.zip` file download in the browser.

- **Endpoint**: `POST /api/mirror`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "selectedNodeIds": [
      "https://example.com/docs/page-1",
      "https://example.com/docs/page-2"
    ],
    "jobId": "job_1786559038_abc12"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "downloadUrl": "/downloads/example-com_2026-08-12_212500.zip",
    "jobId": "job_1786559038_abc12"
  }
  ```

---

## 4. Mirror Job Control
Controls active mirroring tasks (pause, resume, cancel) per job ID.

- **Endpoint**: `POST /api/mirror/control`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "jobId": "job_1786559038_abc12",
    "action": "pause" // "pause" | "resume" | "cancel"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "status": "paused"
  }
  ```
