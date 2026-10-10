# Repository Guidelines

## Project Structure & Module Organization
- `server.js` — the whole backend: Express routes, SQLite access, migrations, backups, cron, exports. About 2,400 lines, grouped by domain with banner comments (`// ITEM API ROUTES`, `// BACKUP AND IMPORT/EXPORT ROUTES`, and so on).
- `public/` — static UI served by Express. One HTML file per page with its JavaScript inline, one CSS file per page, and `shared.css` holding the design tokens and shared components.
  - `inventory.html` (`/`), `management.html` (`/manage`), `insights.html` (`/insights`), `print-all-labels.html` (`/print-all-labels`), `print-label.html` (single label opened from the item modal).
- `data/` — SQLite database and `data/backups/`. Created at runtime, git-ignored, persisted in Docker via `./data:/app/data`.
- `Dockerfile`, `docker-compose.yaml`, `build-and-push.sh` — container build, local orchestration, Docker Hub publish.
- `readme.md` — user-facing docs. `CLAUDE.md` — codebase map for AI assistants. Keep both current when behaviour changes.

## Build, Test, and Development Commands
- `npm install` — install dependencies (Node 18+; the image uses Node 22).
- `npm run dev` — start with nodemon at `http://localhost:3000`.
- `npm start` — production start, also the container command.
- `docker compose up -d --build` — build and run locally with the database in `./data`.
- Override config inline: `PORT=4000 DB_PATH=./tmp/test.db node server.js`. Point `DB_PATH` at a scratch file when experimenting so you never touch real data.

## Coding Style & Naming Conventions
- JavaScript, 4-space indentation, `const`/`let`, semicolons. Match the surrounding code.
- camelCase for variables and functions, lowercase hyphenated route paths, kebab-case asset filenames.
- Routes follow one shape: validate input, run the query with parameters (never string-build SQL), `console.error('Error <doing thing>:', err.message)` on failure, respond with `{ error }` and a sensible status (400, 404, 409, 500).
- Reference tables (brands, sizes, collar sizes) share an identical five-route pattern. If you change one, change all three.
- The database handle is `let db` and is reassigned by the restore endpoint. Never capture it in a long-lived closure at module load.

## UI Conventions
- Every page uses the shared top bar (`.app-header` with `.brand`, `.app-nav`, `.app-actions`) and a `.page-header` title row. Mark the current page's nav link `.active`.
- Style with the tokens in `shared.css`. Do not hard-code colours in page CSS or inline styles.
- Buttons: `.btn` is primary, `.btn-secondary` is the default for everything else, `.btn-danger` for destructive actions, add `.btn-small` for compact variants. Cancel is always secondary.
- No emoji in UI text. No gradients, glassmorphism or hover-lift animations.
- Modals toggle `.show` on `.modal`; never set `style.display`.
- Tables: numeric columns right-aligned with `.price-cell` or `.num`. Inventory columns that can be dropped on narrow screens carry a `col-*` class on both `th` and `td`.

## Testing Guidelines
- No test runner is configured yet. Manual verification is expected: run against a scratch `DB_PATH`, exercise the changed endpoint with `curl`, and load the affected page in a browser.
- If adding tests: use `node:test` with Supertest, put them in `tests/*.test.js`, run them against a temporary database, mock `@aws-sdk/client-s3`, and add a `test` script to `package.json`.
- Always check a fresh database (delete the scratch file) as well as an existing one. Startup migrations are where regressions hide.

## Commit & Pull Request Guidelines
- Commit messages: imperative, present tense, a short title and a body listing what changed and why.
- Group related changes. Call out schema changes and anything that affects backups or restore.
- PRs include a summary, test steps, and screenshots for anything under `public/`.
- Do not commit `.env`, anything in `data/`, or backup files.

## Releasing
- Bump `version` in `package.json` and `VERSION` in `build-and-push.sh`; add a line to the version history in `readme.md` and `CLAUDE.md`.
- Commit, push to `main`, then build and push `jakebroom/vinted-inventory:<version>` and `:latest`. Smoke test the image (health endpoint and creating an item on a fresh database) before pushing.
- Never overwrite a published version tag with different code.

## Security & Configuration Tips
- Configure via `.env`: `PORT`, `DB_PATH`, and optional Wasabi S3 (`WASABI_ENABLED`, `WASABI_ACCESS_KEY_ID`, `WASABI_SECRET_ACCESS_KEY`, `WASABI_BUCKET_NAME`, `WASABI_REGION`, `WASABI_ENDPOINT`, `WASABI_RETENTION_DAYS`). Never commit secrets.
- There is deliberately no authentication at present. Do not add it without agreement; do keep the app safe to run without it (validate filenames, parameterise SQL, no shelling out).
- Any endpoint that takes a filename must go through `resolveBackupPath()` so it cannot escape `data/backups/`.
- Docker runs as the `node` user on port 3000. Verify with `/health`.
