# 📦 Vinted Inventory System

A comprehensive inventory management system for Vinted sellers with SQLite database, advanced reporting, brand management, and a modern web interface.

## 🚀 Quick Start

### Option 1: Docker (Recommended for Production)

#### Prerequisites
- Docker
- Docker Compose

#### Setup
```bash
# Clone or navigate to project directory
cd vinted-inventory

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Access the application
# Open http://localhost:3000 in your browser
```

### Option 2: Local Development

#### Prerequisites
- Node.js (v16.0.0 or higher)
- npm

#### Setup
```bash
# Install dependencies
npm install

# Start the application
npm start

# Or for development with auto-restart
npm run dev

# Access the application
# Open http://localhost:3000 in your browser
```

## 📁 File Structure

```
vinted-inventory/
├── server.js              # Express.js backend server
├── package.json           # Node.js dependencies and scripts
├── Dockerfile             # Docker container configuration
├── docker-compose.yaml    # Docker Compose orchestration
├── .dockerignore          # Files to exclude from Docker build
├── public/
│   ├── inventory.html     # Main table view
│   ├── inventory.css      # Table view styles
│   ├── management.html    # Management page
│   ├── management.css     # Management styles
│   ├── insights.html      # Analytics & insights
│   ├── insights.css       # Insights styles
│   ├── print-label.html   # Print label page
│   └── favicon.svg        # Site favicon
└── data/
    └── inventory.db       # SQLite database (auto-created)
```

## 🎯 Features

### Core Functionality
✅ **Item Management** - Add, edit, delete items with full details
✅ **Advanced Fields** - Name, color, size, collar size, brand, prices, condition, location, season, platform
✅ **Sold/Available Tracking** - Mark items as sold with automatic date tracking
✅ **Search & Filter** - Real-time search with status filters
✅ **QR Code Generation** - Unique QR codes for each item
✅ **Sortable Tables** - Click column headers to sort
✅ **Print Labels** - Print-friendly labels with QR codes

### Management Features
✅ **Brand Management** - Add, edit, activate/deactivate brands
✅ **Size Management** - Manage clothing sizes (XXS-XXXL, One Size)
✅ **Collar Size Management** - Track shirt collar sizes (14-20)
✅ **Bulk Operations** - Delete sold items, remove duplicates, reset database
✅ **Database Maintenance** - Optimize, repair, integrity checks

### Analytics & Insights
✅ **Dashboard Statistics** - Total items, sold items, active inventory, active listings value
✅ **Financial Tracking** - Profit calculations from sold items
✅ **Brand Performance** - See which brands sell best
✅ **Location Reports** - Track items by storage location
✅ **Charts & Visualizations** - Interactive charts with Chart.js

### Export & Reporting
✅ **CSV Export** - Export all items, sold items, or active items
✅ **Brand Reports** - Detailed brand performance analysis
✅ **Profit Reports** - Profit margins and ROI tracking
✅ **Location Reports** - Inventory by location
✅ **Database Backup** - Download complete database file

### Technical Features
✅ **REST API** - Full API for integrations
✅ **SQLite Database** - Persistent storage with automatic migrations
✅ **Responsive Design** - Works on mobile and desktop
✅ **Modern UI** - Purple gradient theme with glassmorphism effects
✅ **No Build Process** - Vanilla JavaScript and CSS

## 🔧 Usage

### Main Pages

**Inventory (Table View)** - `http://localhost:3000/`
- View all items in a sortable table
- Search and filter by status
- Quick edit, mark as sold, or delete
- Export to CSV

**Management** - `http://localhost:3000/manage`
- Add and manage items
- Manage brands, sizes, and collar sizes
- Database cleanup and maintenance
- Bulk operations

**Insights** - `http://localhost:3000/insights`
- View analytics and statistics
- Visual charts and graphs
- Export detailed reports
- Track profit and performance

## 🌐 API Endpoints

### Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | Get all items |
| GET | `/api/items?search=term` | Search items |
| GET | `/api/items?status=sold` | Filter by status |
| GET | `/api/items/:id` | Get single item |
| POST | `/api/items` | Add new item |
| PUT | `/api/items/:id` | Update item |
| PATCH | `/api/items/:id/sold` | Mark as sold/available |
| DELETE | `/api/items/:id` | Delete item |

### Brands
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/brands` | Get active brands |
| GET | `/api/brands/all` | Get all brands |
| POST | `/api/brands` | Add new brand |
| PUT | `/api/brands/:id` | Update brand |
| DELETE | `/api/brands/:id` | Delete brand |

### Sizes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sizes` | Get active sizes |
| GET | `/api/sizes/all` | Get all sizes |
| POST | `/api/sizes` | Add new size |
| PUT | `/api/sizes/:id` | Update size |
| DELETE | `/api/sizes/:id` | Delete size |

### Collar Sizes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collar-sizes` | Get active collar sizes |
| GET | `/api/collar-sizes/all` | Get all collar sizes |
| POST | `/api/collar-sizes` | Add new collar size |
| PUT | `/api/collar-sizes/:id` | Update collar size |
| DELETE | `/api/collar-sizes/:id` | Delete collar size |

### Analytics & Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get inventory statistics |
| GET | `/api/cleanup/stats` | Get cleanup statistics |
| GET | `/api/export/csv` | Export all items to CSV |
| GET | `/api/export/sold` | Export sold items to CSV |
| GET | `/api/export/active` | Export active items to CSV |
| GET | `/api/export/brand-report` | Brand performance report |
| GET | `/api/export/profit-report` | Profit analysis report |
| GET | `/api/export/location-report` | Location inventory report |

### Maintenance
| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | `/api/cleanup/sold` | Delete all sold items |
| DELETE | `/api/cleanup/duplicates` | Remove duplicate items |
| DELETE | `/api/cleanup/reset` | Reset entire database |
| POST | `/api/maintenance/optimize` | Optimize database |
| POST | `/api/maintenance/repair` | Repair database |
| GET | `/api/backup` | Download database backup |

### Example API Usage
```bash
# Add an item
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dress Shirt",
    "color": "Blue",
    "size": "M",
    "collar_size": "15.5",
    "brand": "Ralph Lauren",
    "bought_price": 10.00,
    "selling_price": 25.99,
    "condition_item": "Like New",
    "location": "Box A",
    "season": "All Season",
    "platform": "Vinted"
  }'

# Search items
curl "http://localhost:3000/api/items?search=shirt&status=available"

# Get statistics
curl http://localhost:3000/api/stats

# Mark item as sold
curl -X PATCH http://localhost:3000/api/items/1/sold \
  -H "Content-Type: application/json" \
  -d '{"is_sold": true}'
```

## ⚙️ Configuration

### Environment Variables
```bash
# Optional configuration
export PORT=3000                          # Server port (default: 3000)
export DB_PATH=./data/inventory.db        # Database path
export NODE_ENV=production                # Production mode

# Wasabi S3 Configuration (for remote backups)
export WASABI_ENABLED=true                # Enable Wasabi remote backups
export WASABI_ACCESS_KEY_ID=your_key      # Wasabi access key
export WASABI_SECRET_ACCESS_KEY=your_secret # Wasabi secret key
export WASABI_BUCKET_NAME=your_bucket     # Wasabi bucket name
export WASABI_REGION=us-east-1            # Wasabi region
export WASABI_RETENTION_DAYS=14           # Keep backups for 14 days (default)
```

Copy `.env.example` to `.env` and configure your Wasabi credentials for automated remote backups.

### Custom Port
```bash
PORT=8080 npm start
```

## 💾 Data Management

### Backup

#### Local Backups
- **Web Interface**: Use "Download Backup" button in Management page
- **Manual**: Copy `./data/inventory.db` file
- **Automated Daily**: Automatic backups run at 3 AM (stored in `./data/backups/`)
- **Retention**: Last 7 automated backups are kept

#### Remote Backups (Wasabi)
- **Setup**: Configure Wasabi credentials in `.env` file
- **Automated**: Daily backups automatically upload to Wasabi when enabled
- **Retention**: Automatically deletes backups older than 14 days (configurable via `WASABI_RETENTION_DAYS`)
- **Manual Upload**: Upload existing backups via API endpoint
- **List Remote**: View all backups stored in Wasabi

API Endpoints for Wasabi:
```bash
# List remote backups
GET /api/backups/wasabi/list

# Upload existing backup to Wasabi
POST /api/backups/:filename/upload-to-wasabi
```

**Retention Policy**: By default, Wasabi backups older than 14 days are automatically deleted during the daily backup process. You can customize this by setting `WASABI_RETENTION_DAYS` in your `.env` file (e.g., `WASABI_RETENTION_DAYS=30` for 30 days).

### Restore

#### Via Web Interface (Recommended)
1. Go to Management page → Database Backups section
2. Click "Restore" next to the backup you want to restore
3. Confirm the restoration
4. The system will automatically:
   - Create a safety backup of your current database
   - Close the database connection
   - Replace the database with the selected backup
   - Reopen and validate the connection
   - Roll back if any issues are detected

#### Manual Restore
1. Stop the application
2. Replace `./data/inventory.db` with your backup file
3. Restart the application: `npm start`

**API Endpoint**: `POST /api/backups/:filename/restore`

### Database Maintenance
- **Optimize**: Management page → Database Maintenance → Optimize
- **Repair**: Management page → Database Maintenance → Repair
- **Clear Data**: Management page → Clean Database → Reset Database

## 🎨 Customization

### Design System
The application uses a modern purple gradient theme with:
- Primary gradient: `#667eea` → `#764ba2`
- Glassmorphism effects with backdrop blur
- Responsive flexbox layouts
- System fonts for optimal performance

### Modifying Colors
Edit the CSS files in the `public/` directory:
- `inventory.css` - Table view styles
- `management.css` - Management page styles
- `insights.css` - Analytics page styles

## 🛠️ Troubleshooting

### Docker Issues

#### Port Already in Use
```bash
# Check what's using port 3000
docker ps | grep 3000
# Or change port in docker-compose.yaml
ports:
  - "3001:3000"
```

#### Container Won't Start
```bash
# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose down
docker system prune -f
docker-compose up --build
```

#### Permission Issues on Data Directory
```bash
# Fix permissions (Linux/Mac)
sudo chown -R $USER:$USER ./data

# Or run container with user ID
docker-compose down
docker-compose run --user $(id -u):$(id -g) vinted-inventory
```

### Local Development Issues

#### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000
# Or use a different port
PORT=3001 npm start
```

#### Missing Dependencies
```bash
npm install
```

### Database Issues

#### Database Locked
```bash
# Docker
docker-compose restart

# Local
rm data/*.db-journal
npm start
```

#### Database Corruption
Use the repair function in Management page or:
```bash
sqlite3 data/inventory.db "PRAGMA integrity_check;"
```

#### Backup Database Before Changes
```bash
# Docker
docker-compose exec vinted-inventory cp /app/data/inventory.db /app/data/backup.db

# Local
cp data/inventory.db data/backup.db
```

## 🚀 Production Deployment

### Docker Deployment (Recommended)

#### Basic Docker Commands
```bash
# Build and start
docker-compose up -d --build

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Update after code changes
docker-compose down
docker-compose up -d --build
```

#### Docker Configuration

The application includes a production-ready Docker setup:
- **Node 18 Alpine** base image (lightweight)
- **Health checks** built-in (30s interval)
- **Non-root user** for security
- **Volume persistence** for database
- **Auto-restart** unless stopped manually

#### Custom Port with Docker
```yaml
# Edit docker-compose.yaml
ports:
  - "8080:3000"  # Access via http://localhost:8080
```

#### Production docker-compose.yaml Example
```yaml
services:
  vinted-inventory:
    build: .
    ports:
      - "127.0.0.1:3000:3000"  # Only bind to localhost
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/inventory.db
    restart: unless-stopped
    container_name: vinted-inventory
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Alternative: PM2 (Without Docker)
```bash
npm install -g pm2
pm2 start server.js --name vinted-inventory
pm2 save
pm2 startup
```

### With Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Security Recommendations
- Run behind a reverse proxy (nginx)
- Use Docker with localhost binding for production
- Add authentication if exposing publicly
- Use HTTPS with SSL certificates (Let's Encrypt)
- Regular database backups
- Restrict file permissions on `data/` directory
- Keep Docker images updated

## 📊 Database Schema

### Items Table
- `id` - Primary key
- `name` - Item name
- `color` - Color description
- `size` - Clothing size
- `collar_size` - Shirt collar size
- `brand` - Brand name
- `bought_price` - Purchase price
- `selling_price` - Listed selling price
- `condition_item` - Item condition
- `description` - Item description
- `location` - Storage location
- `season` - Season (Spring/Summer/Fall/Winter/All Season)
- `platform` - Selling platform (default: Vinted)
- `is_sold` - Sold status (0/1)
- `sold_date` - Date sold
- `date_added` - Date added
- `created_at` - Timestamp

### Brands, Sizes, Collar Sizes Tables
- `id` - Primary key
- `name` - Name (unique)
- `is_active` - Active status (0/1)
- `created_at` - Timestamp

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Make changes and test thoroughly
4. Submit a pull request

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🎉 Credits

Built with:
- **Express.js** - Web framework
- **SQLite3** - Database
- **Chart.js** - Data visualization
- Vanilla JavaScript & CSS - Frontend

---

Happy selling on Vinted! 🎉
