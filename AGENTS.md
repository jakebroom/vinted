# Repository Guidelines

## Project Structure & Module Organization
- `server.js` — Express API, SQLite access, backup/cron setup.
- `public/` — static UI (inventory, management, insights, labels). Served by Express.
- `data/` — SQLite database location (`inventory.db`). Auto-created; persisted in Docker via `./data:/app/data`.
- `Dockerfile`, `docker-compose.yaml` — container build and local orchestration.
- `package.json` — scripts and dependencies. `.env` for configuration.

## Build, Test, and Development Commands
- `npm install` — install dependencies (Node >= 16).
- `npm run dev` — start with nodemon at `http://localhost:3000`.
- `npm start` — production start (used in Docker image too).
- `docker compose up -d` — build and run container; persists DB to `./data`.
- Example override: `PORT=4000 DB_PATH=./data/inventory.db node server.js`.

## Coding Style & Naming Conventions
- JavaScript (Node/Express), 2-space indentation, prefer `const`/`let`.
- Use camelCase for variables/functions; keep route paths lowercase with hyphens.
- Keep handlers small and focused; reuse utilities where possible.
- File naming: entrypoint `server.js`; assets in `public/` use kebab-case (e.g., `inventory.css`).

## Testing Guidelines
- No test runner configured yet. If adding tests:
  - Use Node’s `node:test` or Jest + Supertest for API routes.
  - Place tests in `tests/` and name `*.test.js`.
  - Add `"test": "jest"` (or equivalent) to `package.json`.
  - Mock external services (e.g., `@aws-sdk/client-s3`) and avoid real network calls.

## Commit & Pull Request Guidelines
- Commit messages: imperative, concise, present tense (e.g., "add item number column").
- Group related changes; include notes for DB schema changes/migrations.
- PRs must include: summary, linked issue, local test steps, and screenshots for UI changes under `public/`.
- Do not commit `.env` or files in `data/`.

## Security & Configuration Tips
- Configure via `.env`: `PORT`, `DB_PATH`, and optional Wasabi S3 (`WASABI_ENABLED`, `WASABI_*`, `WASABI_REGION`). Never commit secrets.
- Default DB path: `./data/inventory.db`. Ensure `./data` is writable.
- Docker runs on port 3000 by default; verify health at `/health` when using the image.

