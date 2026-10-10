# NewStart Retail Inventory

A small, self-hosted inventory system for people who resell clothing on Vinted and similar platforms. It tracks what you bought, what you paid, where it is stored, what it sold for, and what you made. It prints QR-coded labels, exports reports, and backs itself up every night.

Built with Express, SQLite and plain HTML, CSS and JavaScript. No build step, no framework, one process, one database file.

**Current version: 1.2.0**

---

## Contents

- [Quick start](#quick-start)
- [What it does](#what-it-does)
- [The pages](#the-pages)
- [Configuration](#configuration)
- [Backups and restore](#backups-and-restore)
- [Updating a running install](#updating-a-running-install)
- [API reference](#api-reference)
- [Project layout](#project-layout)
- [Customising the look](#customising-the-look)
- [Database schema](#database-schema)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)
- [Development](#development)
- [Version history](#version-history)

---

## Quick start

### Option 1: Docker Hub image (recommended)

Create a folder with this `docker-compose.yaml`:

```yaml
services:
  vinted-inventory:
    image: jakebroom/vinted-inventory:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/inventory.db
    restart: unless-stopped
    container_name: vinted-inventory
```

Then:

```bash
docker compose up -d
```

Open http://localhost:3000. The database is created in `./data` on first run and survives container updates.

### Option 2: Build from source with Docker

```bash
git clone https://github.com/jakebroom/vinted.git
cd vinted
docker compose up -d --build
```

The compose file in the repo builds the image locally instead of pulling it.

### Option 3: Run with Node

Requires Node.js 18 or newer.

```bash
npm install
npm start          # production
npm run dev        # auto-reload with nodemon
```

---

## What it does

**Items**
- Name, colour, size, collar size, brand, condition, description, storage location, season, platform, item number
- Bought price and sold-for price, with profit and margin calculated for you
- Mark items sold or available with automatic sold-date tracking
- Search across every field, filter by status, sort any column
- Import from CSV or JSON, export to CSV, JSON or Excel

**Labels**
- Every item has a QR code that opens its details when scanned
- Print a single label from the item detail view
- Print a batch of 40mm x 30mm labels as a PDF for thermal label printers

**Reference data**
- Brands, sizes and collar sizes are managed lists with active and inactive states
- Entries in use by items cannot be deleted, only deactivated

**Insights**
- Revenue, cost, gross profit, margin and sell-through for a chosen period
- Revenue and profit by month, brand mix, top brands by revenue, days-to-sell distribution
- Export the filtered dataset as CSV

**Reports**
- CSV reports for all items, sold items, active items, brand performance, profit and storage location

**Backups**
- Automatic daily backup at 03:00, keeping the last seven
- Manual backups on demand from the Management page
- Restore any backup from the browser, with a safety copy and automatic rollback if the restored file is unusable
- Optional upload of every backup to Wasabi S3 with configurable retention

**Maintenance**
- Vacuum and analyse, integrity check and reindex, remove duplicates, delete sold items, reset

---

## The pages

All three pages share the same top bar. Click the mark on the left to return to the inventory.

### Inventory — `/`

The main table. Stat tiles at the top show available, sold and total counts; click a tile to filter by that status, click it again to clear. The search box matches name, colour, size, collar, brand, description, season and platform. Click any row to open the item detail with its QR code and actions. On narrower windows, less important columns hide rather than the table scrolling, and on phones the table becomes a card list.

The **Add item** button in the top bar opens the add form. Import, Export and Print labels are in the page header.

### Management — `/manage`

Tabbed admin area:

- **Overview**: headline numbers, quick actions, recent activity, top brands
- **Brand / Collar Size / Size Management**: add, rename, activate, deactivate, delete
- **Backups**: create, download, restore, delete local backups; list and upload to Wasabi when enabled
- **Export Data**: all CSV, JSON and report exports
- **Cleanup Tools**: destructive operations and database maintenance

### Insights — `/insights`

Filters apply as soon as you change them. The range is based on sold date for sold items and date added for everything else.

### Print labels — `/print-all-labels`

Tick the available items you want, then export a PDF with one label per page.

---

## Configuration

Settings come from environment variables, or a `.env` file in the project root when running with Node. Copy `.env.example` to get started.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DB_PATH` | `./data/inventory.db` | Location of the SQLite file. Backups go in a `backups` folder next to it |
| `WASABI_ENABLED` | `false` | Set to `true` to upload backups to Wasabi |
| `WASABI_ACCESS_KEY_ID` | | Wasabi access key |
| `WASABI_SECRET_ACCESS_KEY` | | Wasabi secret key |
| `WASABI_BUCKET_NAME` | | Bucket to upload into, under a `backups/` prefix |
| `WASABI_REGION` | `us-east-1` | Wasabi region |
| `WASABI_ENDPOINT` | `https://s3.{region}.wasabisys.com` | Override if you use a custom endpoint |
| `WASABI_RETENTION_DAYS` | `14` | Remote backups older than this are deleted after each nightly upload |

With Docker Compose, pass these through the `environment` block or a `.env` file beside the compose file.

The container runs as the unprivileged `node` user, so the host `./data` folder must be writable by it.

---

## Backups and restore

### Where backups live

Local backups are written to `data/backups/` next to the database:

- `backup-auto-<timestamp>.db` from the nightly job, last seven kept
- `backup-manual-<timestamp>.db` from the Management page or API, kept until you delete them
- `safety-backup-<ms>.db` taken immediately before a restore, deleted five minutes after a successful restore

The timestamp in the filename is the source of truth for ordering, so copying the files between machines does not confuse the retention logic.

### Restoring

1. Management → Backups
2. Click **Restore** next to the backup and confirm

The server copies the current database to a safety backup, closes its connection, swaps the file, reopens, and runs a test query. If the test fails it swaps the safety backup back and tells you. Nothing is lost either way.

To restore by hand instead: stop the app, replace `data/inventory.db` with the backup, start the app.

### Wasabi

When enabled, every manual and automatic backup is uploaded to `backups/<filename>` in your bucket, and after each nightly upload any remote backup older than `WASABI_RETENTION_DAYS` is removed. The Backups tab shows the remote list and offers an Upload button on local backups that are not yet remote.

---

## Updating a running install

If your compose file uses the Docker Hub image:

```bash
docker compose pull && docker compose up -d
```

If it builds from source:

```bash
git pull --ff-only && docker compose up -d --build
```

Your data is in the `./data` volume and is untouched. Schema changes are applied automatically on startup. Check it came up with:

```bash
curl -s http://localhost:3000/health
```

---

## API reference

Everything is JSON. Errors return `{ "error": "message" }` with an appropriate status code. There is no authentication; see [Security notes](#security-notes).

### Items

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/items` | All items. Optional `?search=` (name, colour, size, brand, description, location) and `?status=sold` or `?status=available` |
| GET | `/api/items/:id` | One item |
| POST | `/api/items` | Create. `name`, `color` and `size` are required |
| PUT | `/api/items/:id` | Update any subset of fields |
| PATCH | `/api/items/:id/sold` | Body `{ "is_sold": true }` or `false`. Sets or clears `sold_date` |
| DELETE | `/api/items/:id` | Delete |

Item fields: `name`, `color`, `size`, `collar_size`, `brand`, `bought_price`, `sold_for_price`, `condition_item`, `description`, `location`, `season`, `platform`, `item_number`, `is_sold`, `sold_date`. The legacy `price` field is still read as a fallback for `sold_for_price`.

### Brands, sizes and collar sizes

The three reference lists share one pattern. Replace `{resource}` with `brands`, `sizes` or `collar-sizes`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/{resource}` | Active entries, for dropdowns |
| GET | `/api/{resource}/all` | All entries including inactive |
| POST | `/api/{resource}` | Create. Names are unique, case-insensitively |
| PUT | `/api/{resource}/:id` | Rename or set `is_active` |
| DELETE | `/api/{resource}/:id` | Delete. Returns 409 if any item uses it |

### Statistics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stats` | `totalItems`, `soldItems`, `activeItems`, `totalValue` (listing value of unsold items), `profit` (realised, sold items with a bought price), `totalBrands` |
| GET | `/api/cleanup/stats` | Sold count, duplicate count, database size |
| GET | `/health` | `200` with uptime when the database answers, `503` otherwise |

### Exports and imports

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/export/csv` | All items as CSV |
| GET | `/api/export/json` | All items as JSON |
| GET | `/api/export/excel` | All items as an `.xlsx` workbook |
| GET | `/api/export/sold` | Sold items with profit, CSV |
| GET | `/api/export/active` | Unsold items with expected profit, CSV |
| GET | `/api/export/brand-report` | Per-brand counts, averages and profit, CSV |
| GET | `/api/export/profit-report` | Per-item profit and margin, CSV |
| GET | `/api/export/location-report` | Per-location counts and brands, CSV |
| POST | `/api/export/labels-pdf` | Body `{ "itemIds": [1, 2] }`. Returns a PDF of 40mm x 30mm labels with QR codes |
| POST | `/api/import` | Body `{ "format": "csv" or "json", "data": "<file contents>" }`. Accepts the column names produced by the exports |

### Backups

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/backups/create` | Take a manual backup, uploading to Wasabi if enabled |
| GET | `/api/backups` | List local backups with size, type and created time |
| GET | `/api/backups/download/:filename` | Download a backup |
| DELETE | `/api/backups/:filename` | Delete a backup |
| POST | `/api/backups/:filename/restore` | Restore, with safety backup and rollback |
| POST | `/api/backups/:filename/upload-to-wasabi` | Upload an existing local backup |
| GET | `/api/backups/wasabi/list` | List remote backups. `400` when Wasabi is disabled |
| GET | `/api/backup` | Legacy: stream a fresh copy of the database as a download |

Filenames must be plain `.db` names. Anything containing a path separator or `..` is rejected with `400`.

### Maintenance

| Method | Endpoint | Description |
|---|---|---|
| DELETE | `/api/cleanup/sold` | Delete every sold item |
| DELETE | `/api/cleanup/duplicates` | Keep the lowest id of each name, colour, size and brand combination |
| DELETE | `/api/cleanup/reset` | Delete all items and brands, reseed default brands |
| POST | `/api/maintenance/optimize` | `VACUUM` then `ANALYZE` |
| POST | `/api/maintenance/repair` | Integrity check, `REINDEX` if it fails |

### Examples

```bash
# Add an item
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Oxford Shirt","color":"White","size":"M","collar_size":"15.5",
       "brand":"Ralph Lauren","bought_price":8.50,"sold_for_price":24.00,
       "condition_item":"Very good","location":"Box A1","item_number":"NS-1000"}'

# Mark it sold
curl -X PATCH http://localhost:3000/api/items/1/sold \
  -H "Content-Type: application/json" -d '{"is_sold": true}'

# Search available items
curl "http://localhost:3000/api/items?search=shirt&status=available"

# Labels for three items
curl -X POST http://localhost:3000/api/export/labels-pdf \
  -H "Content-Type: application/json" -d '{"itemIds":[1,2,3]}' -o labels.pdf
```

---

## Project layout

```
.
├── server.js                  Express app, SQLite access, backups, cron, exports
├── package.json
├── Dockerfile                 node:22-alpine, non-root, health check on /health
├── docker-compose.yaml        Builds from source; swap `build` for `image` to use Docker Hub
├── build-and-push.sh          Builds and pushes jakebroom/vinted-inventory
├── .env.example
├── CLAUDE.md                  Notes for AI coding assistants
├── AGENTS.md                  Contributor conventions
├── public/
│   ├── shared.css             Design tokens and shared components
│   ├── inventory.html / .css  Inventory table, item modals, add and edit forms
│   ├── management.html / .css Management tabs
│   ├── insights.html / .css   Charts and KPIs (Chart.js from CDN)
│   ├── print-all-labels.html  Batch label picker
│   ├── print-label.html       Single 50mm x 80mm browser-printed label
│   ├── print-label-simple.html Minimal variant of the single label
│   └── favicon.svg
└── data/                      Created at runtime, git-ignored
    ├── inventory.db
    └── backups/
```

---

## Customising the look

All colours, spacing, type sizes and radii are CSS custom properties at the top of `public/shared.css`. Change the accent by editing `--color-primary`, `--color-primary-hover`, `--color-primary-soft` and `--color-primary-text`; everything else follows. The page stylesheets only reference tokens, so they rarely need touching.

The maximum content width is `--container-max`. The chart palette for Insights is the `CHART_PALETTE` array at the top of the script in `insights.html`.

The brand mark and name are in the `.brand` link at the top of each page.

---

## Database schema

SQLite, one file. Tables are created and migrated automatically on startup.

**items**

| Column | Notes |
|---|---|
| `id` | Primary key |
| `item_number` | Your own reference, printed on labels |
| `name`, `color`, `size` | Required |
| `collar_size`, `brand` | Stored as text, matched by name against the reference tables |
| `bought_price`, `sold_for_price` | Decimal. `sold_for_price` is the listing price until sold, then the sale price |
| `price` | Legacy. Read as a fallback for `sold_for_price` |
| `condition_item`, `description`, `location`, `season` | Free text |
| `platform` | Defaults to `Vinted` |
| `is_sold`, `sold_date` | Status and the date it was marked sold |
| `date_added`, `created_at` | Set on creation |

**brands**, **sizes**, **collar_sizes**

| Column | Notes |
|---|---|
| `id` | Primary key |
| `name` | Unique |
| `is_active` | Inactive entries are hidden from dropdowns but kept for existing items |
| `created_at` | |

Profit everywhere is `COALESCE(sold_for_price, price, 0) - COALESCE(bought_price, 0)`.

---

## Troubleshooting

**Port already in use**: change the host port in `docker-compose.yaml` (`"3001:3000"`) or run with `PORT=3001 npm start`.

**Container is unhealthy**: `docker compose logs` will show why. The health check hits `/health` inside the container on port 3000 every 30 seconds.

**Permission denied on data**: the container runs as uid 1000. On Linux, `sudo chown -R 1000:1000 ./data`.

**Database is locked**: another process has the file open. Stop it, remove any `inventory.db-journal`, and restart.

**Suspected corruption**: Management → Cleanup Tools → Repair Database, or `sqlite3 data/inventory.db "PRAGMA integrity_check;"`.

**Wasabi list returns 400**: Wasabi is not enabled, or the credentials are incomplete. The server logs a warning at startup if `WASABI_ENABLED` is true but a value is missing.

**Restore failed and rolled back**: the chosen file was not a usable SQLite database. Your previous data is intact. The safety backup is left in `data/backups` for you to check.

---

## Security notes

There is no login and CORS is open. This is designed to run on a private network or behind something that handles authentication for you. If you expose it to the internet, put it behind a reverse proxy with authentication and HTTPS.

Other things the app does for you:

- Backup filenames supplied to the API are validated so they cannot escape the backups directory
- The container runs as a non-root user
- All SQL uses parameterised statements

Keep secrets in `.env` or your orchestrator's secret store. Never commit `.env` or anything in `data/`.

---

## Development

```bash
npm install
npm run dev
```

There is no test suite yet. See `AGENTS.md` for conventions and `CLAUDE.md` for a map of the codebase.

### Releasing

1. Bump `version` in `package.json` and `VERSION` in `build-and-push.sh`
2. Commit and push to `main`
3. Build and push the image:

```bash
docker build -t jakebroom/vinted-inventory:<version> -t jakebroom/vinted-inventory:latest .
docker push jakebroom/vinted-inventory:<version>
docker push jakebroom/vinted-inventory:latest
```

`build-and-push.sh` does the same with an interactive confirmation.

---

## Version history

- **1.2.0** (2026-10-10): UI redesign. Shared top bar on every page, neutral palette with a single accent, no gradients or emoji. Profit column in pounds, clickable stat tiles, columns hide instead of scrolling, Insights filters apply on change, label picker restyled.
- **1.1.6** (2026-10-10): Fixed restore leaving the database connection closed until restart, path traversal in backup download, delete and restore, missing `collar_size` column on fresh installs, and backup ordering on filesystems without birth times. Raised the JSON body limit for imports.
- **1.1.5**: Fixed add brand, size and collar size buttons in the new item modal.
- **1.1.2**: Modal centring, table width, available count, management overview cards.
- **1.1.1**: Introduced `shared.css`.
- **1.1.0**: SIGTERM handling for Docker, repository cleanup.
- **1.0.x**: Initial releases.

---

MIT licence. Built with Express, SQLite, Chart.js, PDFKit and the `qrcode` library.
