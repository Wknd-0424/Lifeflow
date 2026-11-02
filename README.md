<div align="center">

![LifeFlow banner](docs/banner.svg)

# LifeFlow
### Every Drop Connects a Life.

Blood inventory · Expiry tracking · Hospital requests

![Node.js](https://img.shields.io/badge/Node.js-24%2B-43853d?style=flat-square)
![SQLite](https://img.shields.io/badge/Database-SQLite-336791?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f0db4f?style=flat-square)
![Dependencies](https://img.shields.io/badge/Runtime_dependencies-Zero-c53d47?style=flat-square)

[Quick start](#run-locally) · [Features](#features-and-business-rules) · [Lab report](docs/LAB_REPORT.md) · [API](#api)

</div>

---


A complete B.Tech 3rd-year Web Technology lab project. Tracks blood-group inventory, batch expiry dates and hospital requests with a persistent SQLite database.

## Run locally

1. Install **Node.js 24 or later** (the project uses its built-in SQLite module).
2. Clone the repository and open its folder:

   ```bash
   git clone https://github.com/Wknd-0424/Lifeflow.git
   cd Lifeflow
   ```
3. Run `npm start`.
4. Open **http://localhost:3000** in your browser.

No npm packages, database server, API keys or internet connection are needed. Node may print an experimental SQLite warning; the application still runs normally. To change the port in PowerShell: `$env:PORT=3001` then `npm start`.

The database is created at `data/bloodbank.sqlite`. The first launch loads fictional donation batches and hospital requests relative to the current date. Records persist after restarting. To start fresh, stop the server and rename the `data` folder before restarting. Do not use real patient information in this demonstration.

## Demonstration workflow

1. View the dashboard: available units, pending requests, expiring units and dispatch totals.
2. Choose **Add donation**, enter a donor/source, group, unit count, collection date and label expiry date.
3. Open **Blood inventory** and filter by group, batch/source or stock status.
4. Choose **New request**, enter the hospital, contact, blood group, units and priority.
5. Open **Hospital requests** and click **Fulfill**. Confirm dispatch; the server deducts inventory automatically.
6. Try requesting more units than are available. The request remains pending and stock stays unchanged.
7. View **Expiry monitor** for expired and soon-to-expire batches.
8. Download inventory and request CSVs from **Reports**.

## Features and business rules

- Eight blood groups: A+, A−, B+, B−, AB+, AB−, O+, O−.
- Batch-level remaining stock, collection date, expiry date and donor/source.
- Availability excludes expired and depleted batches. Low stock means fewer than 10 units.
- Expiry alerts include today through the next 7 days. A batch remains available through its labelled expiry date, using UTC calendar dates consistently on the server.
- Requests move from Pending to Fulfilled or Cancelled. Processed requests cannot be processed again.
- Fulfillment uses **exact blood-group matching**, allocates earliest expiry first (FEFO), and succeeds only if the whole quantity is available.
- SQLite transactions make allocation and status updates atomic. Allocations retain a request-to-batch audit trail.
- Input validation runs in both browser and server; database constraints prevent negative remaining stock.
- Search, filters, CSV export, activity feed, responsive layout and accessible native forms/dialogs.
- Glassmorphism surfaces with frosted backgrounds, soft gradients, hover effects and reduced-motion support.
- Responsive stock-health ring, an interactive blood availability checker that prefills requests, and a switchable 7/14-day expiry forecast.

## Technology and architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript | Responsive views, forms, filters, CSV export |
| Backend | Node.js HTTP server | REST endpoints, JSON validation, static assets |
| Database | SQLite through `node:sqlite` | Persistent inventory, requests, allocations, activity |
| Tests | Built-in `node:test` | Allocation, validation, cancellation and expiry rules |

```text
Browser → HTTP / JSON API → business rules → SQLite
```

## Project structure

```text
public/index.html     Application shell and forms
public/styles.css     Responsive dashboard design
public/glass.css      Glass theme, dashboard widgets and device breakpoints
public/app.js         Views, forms, API calls, filters and exports
lib/store.js          Schema, seed data, validation and transactional allocation
server.js             HTTP server and routes
test/store.test.js    Core business-rule tests
docs/LAB_REPORT.md    Submission-ready project write-up and viva questions
data/                 Generated database (ignored by Git)
```

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/state` | Dashboard, inventory, requests and recent activity |
| POST | `/api/batches` | Add donation batch |
| POST | `/api/requests` | Create hospital request |
| POST | `/api/requests/:id/fulfill` | Allocate stock and fulfill request |
| POST | `/api/requests/:id/cancel` | Cancel pending request |

Mutation endpoints return the updated state. Errors return `{ "error": "message" }` with an appropriate HTTP status.

## Verification

Run `npm test`. Tests cover FEFO allocation, expired and incompatible stock exclusion, insufficient-stock rollback, repeat-dispatch prevention, cancellation, date/quantity validation and expiry boundary behavior.

## Scope

This is a local educational inventory application, with one lab administrator workspace. Authentication, multi-user roles, blood screening, compatibility assessment, clinical crossmatching and real hospital integrations are outside its scope. It is not a clinical transfusion system. Expiry dates must be entered from the relevant bag label; the app does not determine shelf life.

## Deploy on Render

[Deploy to Render](https://render.com/deploy?repo=https://github.com/Wknd-0424/Lifeflow)

The included Blueprint provisions a Node.js web service with a 1 GB persistent disk for SQLite. This uses paid Render resources; review the displayed cost before deploying. The server uses `HOST=0.0.0.0`, Render's `PORT`, and `/var/data/bloodbank.sqlite`. The `/health` route is used for health checks.

This deployment is a public educational demo: anyone with its URL can modify the sample inventory. Use fictional records only.
