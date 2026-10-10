# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewStart Retail Inventory (repo name `vinted`) is a self-hosted inventory system for someone reselling clothing on Vinted and similar platforms. Express backend, SQLite database, vanilla HTML/CSS/JavaScript frontend. It tracks items with purchase and sale prices, prints QR-coded labels, exports reports, and backs itself up nightly with optional Wasabi S3 upload.

It runs on the owner's home server from the Docker Hub image `jakebroom/vinted-inventory`. There is deliberately no authentication; it lives on a private network.

## Development Commands

### Local Development
```bash
npm install
npm start          # production mode on http://localhost:3000
npm run dev        # nodemon auto-reload
```

Run against a scratch database so you never touch real data:
```bash
PORT=3001 DB_PATH=./tmp/dev.db WASABI_ENABLED=false node server.js
```

### Docker
```bash
docker compose up -d --build        # build from source and run
docker compose logs -f
docker compose down
```

### Releasing
1. Bump `version` in `package.json` and `VERSION` in `build-and-push.sh`. Add a line to Version History below and in `readme.md`.
2. Commit and push to `main`.
3. `docker build -t jakebroom/vinted-inventory:<version> -t jakebroom/vinted-inventory:latest .`
4. Smoke test: run the image, check `/health` returns 200 and `POST /api/items` works on a fresh database.
5. Push both tags. Never overwrite a published version tag with different code.

The owner updates the server with `docker compose pull && docker compose up -d`.

## Architecture

### Backend: `server.js`

Everything lives in one file, about 2,400 lines, grouped by domain with banner comments. Search for the banner rather than relying on line numbers:

| Banner | Contents |
|---|---|
| (top of file) | Env config, Wasabi client, middleware, `let db` connection, `initializeDatabase()`, default seeding, `addMissingColumns()` migrations |
| `ITEM API ROUTES` | CRUD for items, mark sold/available |
| `BRAND API ROUTES`, `COLLAR SIZE API ROUTES`, `SIZE API ROUTES` | Three identical five-route patterns for reference data |
| `STATISTICS AND REPORTS` | `/api/stats` |
| `CLEANUP AND MAINTENANCE ROUTES` | Delete sold, remove duplicates, reset, vacuum, repair, cleanup stats |
| `BACKUP AND IMPORT/EXPORT ROUTES` | `resolveBackupPath()`, `backupCreatedAt()`, backup CRUD, restore, `reopenDatabase()`, Wasabi upload/list/cleanup, cron job, JSON/Excel export, import |
| `EXPORT ROUTES` | CSV exports, reports, PDF labels, legacy `/api/backup` |
| `HEALTH CHECK ENDPOINT` | `/health` |
| `SERVE STATIC FILES` | Page routes `/`, `/manage`, `/insights`, `/print-all-labels` |
| `ERROR HANDLING`, `SERVER STARTUP` | 404/500 handlers, SIGINT/SIGTERM shutdown, `app.listen` |

Key points:
- **`db` is declared with `let`** and reassigned by `reopenDatabase()` after a restore. Always reference the module-level `db` at call time; never capture it at load time.
- **Startup order matters.** `initializeDatabase()` runs the four `CREATE TABLE IF NOT EXISTS` statements and then `addMissingColumns()` inside `db.serialize()`. The items CREATE must include every column the app writes; migrations only exist for upgrading older databases.
- **Backup filenames from requests must pass `resolveBackupPath()`**, which rejects anything that is not a plain `.db` name inside `data/backups/`. This closed a path traversal bug; keep it on any new filename-taking route.
- **Backup ordering uses `backupCreatedAt()`**, which parses the timestamp from the filename and falls back to mtime. Do not use `birthtime`; it is unreliable on Linux/Docker filesystems.
- **JSON body limit is 10mb** to allow imports.

### Database Schema

SQLite at `DB_PATH` (default `./data/inventory.db`).

- **items**: `id`, `item_number`, `name`, `color`, `size`, `collar_size`, `brand`, `bought_price`, `sold_for_price`, `price` (legacy fallback), `condition_item`, `description`, `location`, `season`, `platform` (default `Vinted`), `is_sold`, `sold_date`, `date_added`, `created_at`
- **brands**, **sizes**, **collar_sizes**: `id`, `name` (unique), `is_active`, `created_at`

Patterns:
- Items store brand, size and collar size **by name**, not by id. Renaming a reference entry does not update items (known gap).
- Soft deletion via `is_active`; hard delete refused with 409 if any item uses the name.
- Profit everywhere: `COALESCE(sold_for_price, price, 0) - COALESCE(bought_price, 0)`. `sold_for_price` is the listing price until sold, then the sale price.
- `/api/stats` returns `activeItems` (not `availableItems`).

### Frontend: `public/`

No build step. Each page is one HTML file with its JavaScript inline, plus a page stylesheet. `shared.css` is loaded first everywhere.

| File | Route | Contents |
|---|---|---|
| `inventory.html` + `inventory.css` | `/` | `TableApp` class: table, mobile cards, search/filter/sort, pagination, item detail modal, add/edit forms, import/export. `?item=<id>&popup=true` opens an item (QR codes link here); `?add=1` opens the add form |
| `management.html` + `management.css` | `/manage` | Tabs: overview, brand/collar/size managers (`BrandManager` etc.), backups, exports, cleanup |
| `insights.html` + `insights.css` | `/insights` | `InsightsApp` class, Chart.js 4 from CDN, filters apply on change |
| `print-all-labels.html` | `/print-all-labels` | Batch label picker, posts to `/api/export/labels-pdf` |
| `print-label.html` | opened by the item modal | Single 50mm x 80mm label for browser printing. Not app UI; leave its styling alone |
| `shared.css` | | Design tokens, app header, page header, buttons, forms, modals, badges, cards, stat tiles, tables, toasts, utilities |

### Design System (v1.2.0)

- Neutral application shell: light grey canvas (`--color-bg`), white surfaces with 1px borders, single indigo accent (`--color-primary: #4f46e5`). No gradients, glassmorphism, emoji icons or hover-lift animations.
- Every page shares the same top bar (`.app-header` with `.brand`, `.app-nav`, `.app-actions`) and a `.page-header` title row. Mark the current page's nav link with `.active`.
- All design tokens live in `:root` in `shared.css`. Page CSS references tokens, never hard-coded colours. `--container-max` (2400px) sets the shared content width.
- Button variants: `.btn` (primary, solid indigo), `.btn-secondary` (white, bordered), `.btn-ghost`, `.btn-danger` (outlined red), `.btn-danger-solid`, `.btn-success`, `.btn-small` (compact; combine with a variant). Legacy classes `.btn-glass`, `.btn-info`, `.btn-warning`, `.btn-edit`, `.btn-toggle` render as secondary; `.btn-delete` as outlined danger. Cancel buttons are always secondary.
- Numeric table columns are right-aligned with tabular numerals (`.price-cell`, `.num`). Status and margin use subtle pills.
- Inventory table: columns carry `col-collar`, `col-condition`, `col-season`, `col-platform`, `col-added` on both `th` and `td`, and hide at 1500/1250/1050px breakpoints rather than scrolling. Below 768px the table is replaced by `.mobile-card` elements.
- Stat tiles on the inventory page have `data-filter` and act as status filters.
- Charts sit in `.chart-box` (fixed 300px height, `maintainAspectRatio: false`) and use `CHART_PALETTE` defined at the top of the insights script.
- Modals: toggle `.show` on `.modal` (never `style.display`); white header with bottom border; click outside to close.
- Accessibility: visible focus rings, 36px minimum control height, WCAG 2.1 AA contrast.

## Common Development Tasks

### Adding an item field
1. Add the column to the items `CREATE TABLE` in `initializeDatabase()` **and** to `columnsToAdd` in `addMissingColumns()`.
2. Add it to the INSERT in `POST /api/items`, `allowedFields` in `PUT /api/items/:id`, and the import statement in `POST /api/import`.
3. Add it to the CSV/JSON/Excel exports if it should appear there.
4. In `inventory.html`: add inputs to both the add and edit forms, the table column (with a `col-*` class if it may hide on narrow screens), the mobile card, and the detail modal.

### Adding an API endpoint
Place it under the matching banner. Validate input, use parameterised `db.all` / `db.get` / `db.run`, log with `console.error('Error <doing thing>:', err.message)`, respond with `{ error }` and 400/404/409/500. If it takes a backup filename, resolve it with `resolveBackupPath()`.

### Working with backups
- Files live in `data/backups/`: `backup-auto-*`, `backup-manual-*`, `safety-backup-*`.
- Nightly cron at 03:00 server time creates an auto backup, uploads to Wasabi if enabled, prunes remote backups older than `WASABI_RETENTION_DAYS`, then keeps only the last 7 local auto backups.
- Restore: safety copy of the live DB, close `db`, copy backup over `DB_PATH`, `reopenDatabase()`, test query, roll back on failure. The safety backup is deleted five minutes after success.

### Verifying a change
Run against a scratch `DB_PATH`, delete the file to test a fresh install as well as an upgrade, hit the endpoint with `curl`, and load the page in a browser at desktop and phone widths. The browser console should show no errors other than a `400` from `/api/backups/wasabi/list` when Wasabi is disabled.

## Configuration

Environment variables, or `.env` when running with Node (see `.env.example`):

- `PORT` (default 3000), `DB_PATH` (default `./data/inventory.db`; backups go in `backups/` beside it)
- `WASABI_ENABLED`, `WASABI_ACCESS_KEY_ID`, `WASABI_SECRET_ACCESS_KEY`, `WASABI_BUCKET_NAME`, `WASABI_REGION` (default `us-east-1`), `WASABI_ENDPOINT` (optional), `WASABI_RETENTION_DAYS` (default 14)

Docker: `node:22-alpine`, `npm ci --omit=dev`, runs as the `node` user, health check on `/health` every 30s, `./data` mounted at `/app/data`, `restart: unless-stopped`.

## Known Gaps
- No authentication or CORS restriction. Intentional for now; do not add without being asked.
- Renaming a brand, size or collar size does not update items that reference the old name.
- Manual and nightly backups copy the database file rather than using SQLite's backup API (the legacy `/api/backup` route does use it).
- The CSV importer is hand-rolled and breaks on fields containing newlines.
- Client-side search does not match `item_number` or `location`.
- No automated tests.

## Version History

- **v1.2.0** (2026-10-10): UI redesign - neutral application shell with shared top bar, single indigo accent, no gradients or emoji; profit column in pounds; clickable stat tiles filter the table; columns hide instead of scrolling; Insights filters apply on change; label picker restyled; stale CSS docs removed
- **v1.1.6** (2026-10-10): Fixed restore leaving a closed DB handle, backup filename path traversal, missing collar_size column on fresh installs, backup ordering by filename timestamp; raised JSON body limit; removed third-party QR redirect
- **v1.1.5**: Fixed add brand/size/collar size buttons in the new item modal
- **v1.1.2** (2025-10-31): Modal centering, inventory table width, Available count, management overview cards
- **v1.1.1** (2025-10-30): Created shared.css design system
- **v1.1.0** (2025-10-30): SIGTERM handler for Docker, repository cleanup
- **v1.0.9** and earlier: Initial release and incremental improvements

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health
