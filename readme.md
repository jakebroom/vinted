markdown# 📦 Vinted Inventory System

A Docker-based inventory management system for Vinted sellers with QR code generation, SQLite database, and a modern web interface.

## 🚀 Quick Start

### Prerequisites
- Docker
- Docker Compose

### Setup

1. **Create project directory:**
```bash
mkdir vinted-inventory
cd vinted-inventory

Create the file structure:

vinted-inventory/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server.js
├── .dockerignore
├── public/
│   └── index.html
└── README.md

Copy all the provided files into their respective locations
Run the application:

bashdocker-compose up --build

Access your inventory system:
Open http://localhost:3000 in your browser

📁 File Structure
Root Files

Dockerfile - Docker container configuration
docker-compose.yml - Docker Compose orchestration
package.json - Node.js dependencies and scripts
server.js - Express.js backend server
.dockerignore - Files to exclude from Docker build

Public Directory

public/index.html - Frontend web application

Data Directory (Auto-created)

data/inventory.db - SQLite database (persisted on host)

🎯 Features
Core Functionality
✅ Add Items - Name, color, size, brand, price, condition, description
✅ QR Code Generation - Unique QR codes for each item
✅ Search & Filter - Real-time search across all item fields
✅ Delete Items - Remove sold items from inventory
✅ Persistent Storage - SQLite database with Docker volume
Database Features
✅ Backup/Restore - Download database files
✅ Clear Database - Reset all data
✅ Statistics - Total item counts
✅ Direct Item Links - QR codes link to specific items
Technical Features
✅ Docker Containerized - Easy deployment anywhere
✅ REST API - Full API for integrations
✅ Health Checks - Monitor application status
✅ Responsive Design - Works on mobile and desktop
✅ Real-time Updates - Live connection status
🔧 Management Commands
Basic Operations
bash# Start the application
docker-compose up -d

# Stop the application
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart
Updates & Maintenance
bash# Update after code changes
docker-compose down
docker-compose up --build -d

# Check container status
docker-compose ps

# Access container shell (for debugging)
docker-compose exec vinted-inventory sh
💾 Data Management
Backup

Web Interface: Use "Download Backup" button
Manual: Copy ./data/inventory.db file
Automated: Set up cron job to backup data/ folder

Restore

Replace ./data/inventory.db with your backup file
Restart the container: docker-compose restart

Clear Data

Web Interface: Use "Clear All Data" button
Manual: Delete ./data/inventory.db and restart

🌐 API Endpoints
Base URL: http://localhost:3000/api
MethodEndpointDescriptionGET/itemsGet all itemsGET/items?search=termSearch itemsGET/items/:idGet single itemPOST/itemsAdd new itemPUT/items/:idUpdate itemDELETE/items/:idDelete itemGET/statsGet statisticsGET/backupDownload databaseDELETE/clearClear all dataGET/healthHealth check
Example API Usage
bash# Add an item
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"T-Shirt","color":"Blue","size":"M","brand":"Nike","price":25.99}'

# Search items
curl "http://localhost:3000/api/items?search=blue"

# Get stats
curl http://localhost:3000/api/stats
⚙️ Configuration
Environment Variables
bash# In docker-compose.yml
environment:
  - NODE_ENV=production
  - DB_PATH=/app/data/inventory.db
  - PORT=3000  # Optional, defaults to 3000
Custom Port
yaml# Change port in docker-compose.yml
ports:
  - "8080:3000"  # Access via http://localhost:8080
🚀 Production Deployment
Security Enhancements
yaml# docker-compose.production.yml
version: '3.8'
services:
  vinted-inventory:
    build: .
    ports:
      - "127.0.0.1:3000:3000"  # Only bind to localhost
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "const http = require('http'); http.get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"]
      interval: 30s
      timeout: 10s
      retries: 3
With Reverse Proxy (nginx)
nginxserver {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
🛠️ Troubleshooting
Common Issues
Port already in use:
bash# Check what's using port 3000
sudo lsof -i :3000
# Change port in docker-compose.yml
Database locked:
bash# Stop container and restart
docker-compose down && docker-compose up -d
Permission denied on data folder:
bashsudo chown -R $USER:$USER ./data
Container won't start:
bash# Check logs
docker-compose logs
# Rebuild from scratch
docker-compose down
docker system prune -f
docker-compose up --build
📋 TODO / Future Enhancements

 Image upload for items
 Categories/tags for better organization
 CSV import/export functionality
 Multi-user support with authentication
 Advanced reporting and analytics
 Integration with Vinted API
 Mobile app (React Native)
 Barcode scanning support

🤝 Contributing

Fork the repository
Create your feature branch
Make changes and test with Docker
Submit a pull request

📄 License
MIT License - feel free to use for personal or commercial projects.

Happy selling on Vinted! 🎉

This README provides comprehensive documentation for your Vinted inventory system, including setup instructions, feature descriptions, API documentation, troubleshooting tips, and more!