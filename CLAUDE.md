# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vinted Inventory System - a comprehensive inventory management application for Vinted sellers. It's built with Express.js backend, SQLite database, and vanilla JavaScript/CSS frontend. The system manages clothing items with features like QR code generation, advanced reporting, brand management, and automated backups.

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start the server (production mode)
npm start

# Start with auto-reload (development mode)
npm run dev

# Access the application
# http://localhost:3000
```

### Docker Development
```bash
# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose down && docker-compose up -d --build

# Stop containers
docker-compose down
```

## Architecture

### Backend Structure

**Single File Architecture**: All backend code is in `server.js` (~2170 lines). The file is organized into clear sections:

1. **Configuration & Initialization (lines 1-61)**: Environment setup, middleware, database connection
2. **Database Schema Management (lines 64-278)**: Table creation, migrations, default data seeding
3. **API Routes by Domain**:
   - Items API (lines 284-461): CRUD operations for inventory items
   - Brands API (lines 467-653): Brand management with active/inactive states
   - Collar Sizes API (lines 659-845): Shirt collar size management
   - Sizes API (lines 851-1037): Clothing size management
   - Statistics & Reports (lines 1043-1099): Dashboard stats and analytics
   - Cleanup & Maintenance (lines 1105-1273): Database operations (vacuum, integrity checks, duplicates removal)
   - Backup & Import/Export (lines 1279-1709): Manual/automated backups, Wasabi S3 integration, CSV/JSON/Excel export
   - Export Routes (lines 1715-2091): Multiple export formats including PDF labels with QR codes

4. **Automated Jobs**: Daily backup at 3 AM using node-cron (line 1526)
5. **Wasabi S3 Integration**: Optional remote backup uploads configured via environment variables

### Database Schema

**SQLite Database** (`./data/inventory.db`):

- **items table**: Main inventory with fields like name, color, size, brand, bought_price, selling_price, is_sold, collar_size, location, season, platform, item_number
- **brands table**: Brand registry with is_active flag for soft deletion
- **sizes table**: Clothing sizes (XXS-XXXL, One Size) with active state management
- **collar_sizes table**: Shirt collar sizes (14-20) with active state management

Key patterns:
- Soft deletion using `is_active` flags on reference tables
- Cannot delete brands/sizes/collar_sizes if used by items (enforced in API)
- Auto-incrementing IDs, timestamps, default values
- Support for legacy `price` field (replaced by separate `bought_price`/`selling_price`)

### Frontend Structure

**Public Directory** (`./public/`):
- `shared.css`: Common design system with CSS variables, modal system, buttons, forms (v1.1.0+)
- `inventory.html` + `inventory.css`: Main table view with search, filter, sorting, pagination
- `management.html` + `management.css`: Item creation, brand/size management, database maintenance, overview dashboard
- `insights.html` + `insights.css`: Analytics dashboard with Chart.js visualizations
- `print-label.html`, `print-all-labels.html`, `print-label-simple.html`: QR code label printing
- All use vanilla JavaScript (no frameworks), fetch API for backend calls

**Design System** (v1.1.3):
- Purple gradient theme (#667eea → #764ba2) with glassmorphism effects
- Shared CSS architecture: `shared.css` contains base styles and all button variants (~150 lines), page-specific CSS for customizations only
- Modal system: CSS class-based (`.show`) with flexbox centering, click-outside-to-close, no X close buttons
- Button variants: All consolidated in shared.css - `.btn` (purple gradient), `.btn-glass` (transparent for gradients), `.btn-info`, `.btn-warning`, `.btn-small`, `.btn-edit`, `.btn-toggle`, `.btn-delete`, `.btn-danger`
- Responsive design: Mobile card view for inventory (<768px), desktop table view (≥768px)
- Accessibility: Focus states, 44px touch targets, WCAG 2.1 AA contrast ratios
- CSS Consolidation (v1.1.3): Removed ~120 lines of duplicate button CSS from inventory.css and management.css

### Key Technical Patterns

1. **Database Migrations**: `addMissingColumns()` function safely adds new columns to support schema evolution
2. **Automated Backups**:
   - Daily cron job at 3 AM creates `backup-auto-TIMESTAMP.db`
   - Keeps last 7 automated backups
   - Optional Wasabi S3 upload for remote storage
3. **Duplicate Prevention**: Checks for existing brands/sizes before insertion using case-insensitive matching
4. **Profit Calculations**: Uses `COALESCE(selling_price, price, 0) - COALESCE(bought_price, 0)` pattern throughout
5. **Search Implementation**: Multi-field search using SQL LIKE across name, color, size, brand, description, location
6. **QR Code Generation**: Items get QR codes linking to `/?item={id}&popup=true` for quick access
7. **PDF Label Generation**: Uses PDFKit to create 40mm x 30mm labels with QR codes for thermal printers

## Common Development Tasks

### Adding New Item Fields

1. Add column in `addMissingColumns()` function (server.js:249-278)
2. Update SQL queries in POST/PUT endpoints (server.js:336-372, 375-418)
3. Update export functions to include new field (server.js:1715+)
4. Add form field in `management.html` and display in `inventory.html`

### Adding New API Endpoints

Follow the established pattern:
- Place in appropriate section based on domain (items/brands/sizes/stats/export)
- Use db.all() for SELECT, db.run() for INSERT/UPDATE/DELETE, db.get() for single row
- Return proper HTTP status codes (200, 201, 400, 404, 409, 500)
- Include error logging with console.error()
- Use prepared statements to prevent SQL injection

### Working with Backups

- Manual backups: POST `/api/backups/create`
- List backups: GET `/api/backups`
- Download: GET `/api/backups/download/:filename`
- Restore backup: POST `/api/backups/:filename/restore`
- Wasabi upload: POST `/api/backups/:filename/upload-to-wasabi`
- Backup files stored in `./data/backups/`

**Restore Process**: The restore endpoint safely closes the database connection, creates a safety backup of the current state, replaces the database file, reopens the connection, and validates the restored database. If validation fails, it automatically rolls back to the safety backup.

**Retention Policy**:
- Local backups: Keep last 7 automated backups (cleaned up after each automated backup)
- Wasabi backups: Keep backups for `WASABI_RETENTION_DAYS` (default: 14 days). Cleanup runs after each automated backup upload.

## Configuration

### Environment Variables (.env)

Required:
- `PORT`: Server port (default: 3000)
- `DB_PATH`: Database file path (default: ./data/inventory.db)

Optional (Wasabi S3 remote backups):
- `WASABI_ENABLED`: Set to "true" to enable
- `WASABI_ACCESS_KEY_ID`: Wasabi access key
- `WASABI_SECRET_ACCESS_KEY`: Wasabi secret key
- `WASABI_BUCKET_NAME`: Bucket name
- `WASABI_REGION`: Region (default: us-east-1)
- `WASABI_RETENTION_DAYS`: Days to keep backups (default: 14)
- `WASABI_ENDPOINT`: Custom endpoint (optional)

### Docker Configuration

- Base image: node:18-alpine (lightweight, production-ready)
- Non-root user: Runs as 'node' user for security
- Health check: Built-in HTTP check on /health endpoint (server.js:2155 area - note: health endpoint not implemented, Dockerfile references it)
- Volume: `./data` mounted to `/app/data` for database persistence
- Auto-restart: `restart: unless-stopped` in docker-compose.yaml

## Database Operations

### Maintenance Operations

- **Optimize**: POST `/api/maintenance/optimize` - Runs VACUUM and ANALYZE
- **Repair**: POST `/api/maintenance/repair` - Integrity check and REINDEX if needed
- **Delete Sold Items**: DELETE `/api/cleanup/sold`
- **Remove Duplicates**: DELETE `/api/cleanup/duplicates` - Based on name+color+size+brand
- **Reset Database**: DELETE `/api/cleanup/reset` - Deletes all items and brands, reseeds defaults

### Brand/Size Management Pattern

All reference tables (brands, sizes, collar_sizes) follow the same API pattern:
- GET `/api/{resource}` - Active items only (for dropdowns)
- GET `/api/{resource}/all` - All items including inactive (for management UI)
- POST `/api/{resource}` - Create with uniqueness validation
- PUT `/api/{resource}/:id` - Update name or is_active state
- DELETE `/api/{resource}/:id` - Delete only if unused by items (returns 409 if used)

## Testing & Debugging

- Server logs include clear prefixes: "Error {action}:", "Successfully {action}"
- Database errors log full error.message
- All API errors return JSON with `{ error: "message" }` format
- Check `./data/backups/` for automated backup files (retention: 7 days)
- Use `/api/stats` and `/api/cleanup/stats` for database health checks

## Important Notes

- **Database File**: Must be writable. Docker uses non-root user, ensure permissions on `./data/`
- **Graceful Shutdown**: SIGINT and SIGTERM handlers close database connection properly (server.js, v1.1.0+)
- **Legacy Fields**: `price` field kept for backwards compatibility, prefer `selling_price`
- **QR Codes**: Generated server-side using `qrcode` library, embedded in PDFs and HTML
- **No Build Process**: Pure vanilla JS/CSS, no transpilation or bundling needed
- **Health Check**: GET `/health` endpoint checks database connectivity, returns 200 (healthy) or 503 (unhealthy) with uptime info
- **Modal System**: All modals use CSS classes (`.show`) instead of inline styles for proper centering (v1.1.2)
- **Stats API**: Returns `activeItems` (not `availableItems`) for unsold item count

## CSS Architecture (v1.1.1+)

**Shared Design System** (`shared.css`):
- CSS custom properties for colors, spacing, typography
- Base styles: body, containers, buttons, forms, tables, modals
- Utility classes and responsive breakpoints
- Eliminates ~400+ lines of duplicate CSS across pages

**Page-Specific CSS**:
- `inventory.css`: Table layouts, stats bar, pagination, mobile card view
- `management.css`: Tab navigation, overview cards, brand/size/collar management cards, backup tables
- `insights.css`: KPI cards with glassmorphism, chart containers, filter controls

**Modal Pattern**:
- HTML: Modals with `.modal` class, initially hidden
- JavaScript: Use `classList.add('show')` and `classList.remove('show')` (NOT `style.display`)
- CSS: `.modal.show` uses flexbox to center modal-content
- No X close buttons - click outside modal to close (event listener on modal background)

## Version History

- **v1.1.2** (2025-10-31): UI improvements - modal centering, inventory table width (95%), fixed Available count, restored management overview cards, white text on insights page, enhanced button styling
- **v1.1.1** (2025-10-30): CSS refactoring - created shared.css design system, eliminated duplicate styles
- **v1.1.0** (2025-10-30): Security improvements - added SIGTERM handler for Docker, cleaned up git repository
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
