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
            price REAL, -- legacy, kept for back-compat
            condition_item TEXT,
            description TEXT,
            date_added TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_sold BOOLEAN DEFAULT 0,
            sold_date TEXT
        );
    `;
    
    db.run(createTableSQL, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Database table initialized successfully');
            addSoldColumns();
            addPriceColumns();
            addLocationSeasonColumns();
        }
    });
}

// Add sold columns to existing database
function addSoldColumns() {
    db.run('ALTER TABLE items ADD COLUMN is_sold BOOLEAN DEFAULT 0', (err) => {
        if (err && !String(err.message).includes('duplicate column')) {
            console.error('Error adding is_sold column:', err.message);
        }
    });
    
    db.run('ALTER TABLE items ADD COLUMN sold_date TEXT', (err) => {
        if (err && !String(err.message).includes('duplicate column')) {
            console.error('Error adding sold_date column:', err.message);
        }
    });
}

// Add pricing columns & migrate legacy price -> selling_price
function addPriceColumns() {
    db.run('ALTER TABLE items ADD COLUMN selling_price REAL', (err) => {
        if (err && !String(err.message).includes('duplicate column')) {
            console.error('Error adding selling_price column:', err.message);
        } else {
            db.run(
                'UPDATE items SET selling_price = price WHERE selling_price IS NULL AND price IS NOT NULL',
                (e) => {
                    if (e) console.error('Error migrating price to selling_price:', e.message);
                }
            );
        }
    });

    db.run('ALTER TABLE items ADD COLUMN bought_price REAL', (err) => {
        if (err && !String(err.message).includes('duplicate column')) {
            console.error('Error adding bought_price column:', err.message);
        }
    });
}

// Add location, season, and platform columns
function addLocationSeasonColumns() {
    db.run('ALTER TABLE items ADD COLUMN location TEXT', (err) => {
        if (err && !String(err.message).includes('duplicate column')) {
            console.error('Error adding location column:', err.message);
        }
    });

    db.run('ALTER TABLE items ADD COLUMN season TEXT', (err) => {
        if (err && !String(err.message).includes('duplicate column')) {
            console.error('Error adding season column:', err.message);
        }
    });

    db.run('ALTER TABLE items ADD COLUMN platform TEXT DEFAULT "Vinted"', (err) => {
        if (err && !String(err.message).includes('duplicate column')) {
            console.error('Error adding platform column:', err.message);
        }
    });
}

// API Routes

// Get all items
app.get('/api/items', (req, res) => {
    const { search, status } = req.query;
    let sql = 'SELECT * FROM items ORDER BY is_sold ASC, id DESC';
    let params = [];

    if (search && status) {
        sql = `
            SELECT * FROM items 
            WHERE (name LIKE ? OR color LIKE ? OR size LIKE ? OR brand LIKE ? OR location LIKE ? OR season LIKE ? OR platform LIKE ?)
            AND is_sold = ?
            ORDER BY is_sold ASC, id DESC
        `;
        const searchValue = `%${search}%`;
        const soldStatus = status === 'sold' ? 1 : 0;
        params = [searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, soldStatus];
    } else if (search) {
        sql = `
            SELECT * FROM items 
            WHERE name LIKE ? OR color LIKE ? OR size LIKE ? OR brand LIKE ? OR location LIKE ? OR season LIKE ? OR platform LIKE ?
            ORDER BY is_sold ASC, id DESC
        `;
        const searchValue = `%${search}%`;
        params = [searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, searchValue];
    } else if (status) {
        sql = 'SELECT * FROM items WHERE is_sold = ? ORDER BY id DESC';
        const soldStatus = status === 'sold' ? 1 : 0;
        params = [soldStatus];
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
    const { 
        name, 
        color, 
        size, 
        brand, 
        price, 
        selling_price, 
        bought_price, 
        condition_item, 
        description,
        location,
        season,
        platform
    } = req.body;
    
    if (!name || !color || !size) {
        return res.status(400).json({ error: 'Name, color, and size are required' });
    }

    const sql = `
        INSERT INTO items (name, color, size, brand, selling_price, bought_price, condition_item, description, location, season, platform, date_added)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const selling = (selling_price ?? price);
    const values = [
        name,
        color,
        size,
        brand || null,
        selling !== undefined && selling !== '' ? parseFloat(selling) : null,
        bought_price !== undefined && bought_price !== '' ? parseFloat(bought_price) : null,
        condition_item || null,
        description || null,
        location || null,
        season || null,
        platform || 'Vinted',
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
    const { 
        name, 
        color, 
        size, 
        brand, 
        price, 
        selling_price, 
        bought_price, 
        condition_item, 
        description,
        location,
        season,
        platform
    } = req.body;
    
    if (!name || !color || !size) {
        return res.status(400).json({ error: 'Name, color, and size are required' });
    }

    const sql = `
        UPDATE items 
        SET name = ?, color = ?, size = ?, brand = ?, selling_price = ?, bought_price = ?, 
            condition_item = ?, description = ?, location = ?, season = ?, platform = ?
        WHERE id = ?
    `;
    
    const selling = (selling_price ?? price);
    const values = [
        name,
        color,
        size,
        brand || null,
        selling !== undefined && selling !== '' ? parseFloat(selling) : null,
        bought_price !== undefined && bought_price !== '' ? parseFloat(bought_price) : null,
        condition_item || null,
        description || null,
        location || null,
        season || null,
        platform || 'Vinted',
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

// Mark item as sold/unsold
app.patch('/api/items/:id/sold', (req, res) => {
    const { id } = req.params;
    const { is_sold } = req.body;
    
    const soldDate = is_sold ? new Date().toLocaleDateString() : null;
    
    const sql = 'UPDATE items SET is_sold = ?, sold_date = ? WHERE id = ?';
    
    db.run(sql, [is_sold ? 1 : 0, soldDate, id], function(err) {
        if (err) {
            console.error('Error updating item sold status:', err.message);
            res.status(500).json({ error: 'Failed to update item sold status' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.json({ 
                message: is_sold ? 'Item marked as sold' : 'Item marked as available',
                sold_date: soldDate
            });
        }
    });
});

// Get database stats
app.get('/api/stats', (req, res) => {
    const statsQueries = [
        'SELECT COUNT(*) as total FROM items',
        'SELECT COUNT(*) as available FROM items WHERE is_sold = 0',
        'SELECT COUNT(*) as sold FROM items WHERE is_sold = 1'
    ];
    
    Promise.all(statsQueries.map(query => {
        return new Promise((resolve, reject) => {
            db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }))
    .then(results => {
        res.json({
            totalItems: results[0].total || results[0].available || results[0].sold,
            availableItems: results[1].available,
            soldItems: results[2].sold
        });
    })
    .catch(err => {
        console.error('Error fetching stats:', err.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
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

// Page Routes - BEFORE static middleware

// Serve the table view as home page  
app.get('/', (req, res) => {
    console.log('Serving inventory.html for /');
    res.sendFile(path.join(__dirname, 'public', 'inventory.html'));
});

// Serve the management page (card view with form)
app.get('/manage', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'management.html'));
});

// Serve the insights page (analytics & charts)
app.get('/insights', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'insights.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: fs.existsSync(DB_PATH) ? 'connected' : 'not found'
    });
});

// Static middleware AFTER routes
app.use(express.static('public'));

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