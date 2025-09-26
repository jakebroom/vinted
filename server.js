const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/inventory.db';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', DB_PATH);
        initializeDatabase();
    }
});

// Create tables if they don't exist
function initializeDatabase() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            size TEXT NOT NULL,
            brand TEXT,
            price REAL,
            condition_item TEXT,
            description TEXT,
            date_added TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    db.run(createTableSQL, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Database table initialized successfully');
        }
    });
}

// API Routes

// Get all items
app.get('/api/items', (req, res) => {
    const { search } = req.query;
    let sql = 'SELECT * FROM items ORDER BY id DESC';
    let params = [];

    if (search) {
        sql = `
            SELECT * FROM items 
            WHERE name LIKE ? OR color LIKE ? OR size LIKE ? OR brand LIKE ?
            ORDER BY id DESC
        `;
        const searchValue = `%${search}%`;
        params = [searchValue, searchValue, searchValue, searchValue];
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching items:', err.message);
            res.status(500).json({ error: 'Failed to fetch items' });
        } else {
            res.json(rows);
        }
    });
});

// Get single item by ID
app.get('/api/items/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching item:', err.message);
            res.status(500).json({ error: 'Failed to fetch item' });
        } else if (!row) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.json(row);
        }
    });
});

// Add new item
app.post('/api/items', (req, res) => {
    const { name, color, size, brand, price, condition_item, description } = req.body;
    
    if (!name || !color || !size) {
        return res.status(400).json({ error: 'Name, color, and size are required' });
    }

    const sql = `
        INSERT INTO items (name, color, size, brand, price, condition_item, description, date_added)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        name,
        color,
        size,
        brand || null,
        price ? parseFloat(price) : null,
        condition_item || null,
        description || null,
        new Date().toLocaleDateString()
    ];

    db.run(sql, values, function(err) {
        if (err) {
            console.error('Error adding item:', err.message);
            res.status(500).json({ error: 'Failed to add item' });
        } else {
            res.json({ 
                id: this.lastID,
                message: 'Item added successfully',
                url: `${req.protocol}://${req.get('host')}/#item-${this.lastID}`
            });
        }
    });
});

// Update item
app.put('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const { name, color, size, brand, price, condition_item, description } = req.body;
    
    if (!name || !color || !size) {
        return res.status(400).json({ error: 'Name, color, and size are required' });
    }

    const sql = `
        UPDATE items 
        SET name = ?, color = ?, size = ?, brand = ?, price = ?, condition_item = ?, description = ?
        WHERE id = ?
    `;
    
    const values = [
        name,
        color,
        size,
        brand || null,
        price ? parseFloat(price) : null,
        condition_item || null,
        description || null,
        id
    ];

    db.run(sql, values, function(err) {
        if (err) {
            console.error('Error updating item:', err.message);
            res.status(500).json({ error: 'Failed to update item' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.json({ message: 'Item updated successfully' });
        }
    });
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting item:', err.message);
            res.status(500).json({ error: 'Failed to delete item' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.json({ message: 'Item deleted successfully' });
        }
    });
});

// Get database stats
app.get('/api/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM items', (err, row) => {
        if (err) {
            console.error('Error fetching stats:', err.message);
            res.status(500).json({ error: 'Failed to fetch stats' });
        } else {
            res.json({ totalItems: row.total });
        }
    });
});

// Database backup endpoint
app.get('/api/backup', (req, res) => {
    if (!fs.existsSync(DB_PATH)) {
        return res.status(404).json({ error: 'Database file not found' });
    }
    
    const readStream = fs.createReadStream(DB_PATH);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="vinted-inventory-${new Date().toISOString().split('T')[0]}.db"`);
    
    readStream.pipe(res);
});

// Clear all data
app.delete('/api/clear', (req, res) => {
    db.run('DELETE FROM items', function(err) {
        if (err) {
            console.error('Error clearing database:', err.message);
            res.status(500).json({ error: 'Failed to clear database' });
        } else {
            res.json({ message: 'Database cleared successfully' });
        }
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: fs.existsSync(DB_PATH) ? 'connected' : 'not found'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Vinted Inventory Server running on port ${PORT}`);
    console.log(`📊 Database: ${DB_PATH}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
});