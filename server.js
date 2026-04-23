require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const cron = require('node-cron');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/inventory.db';

// Wasabi S3 Configuration
const WASABI_ENABLED = process.env.WASABI_ENABLED === 'true';
const WASABI_ACCESS_KEY_ID = process.env.WASABI_ACCESS_KEY_ID;
const WASABI_SECRET_ACCESS_KEY = process.env.WASABI_SECRET_ACCESS_KEY;
const WASABI_BUCKET_NAME = process.env.WASABI_BUCKET_NAME;
const WASABI_REGION = process.env.WASABI_REGION || 'us-east-1';
const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT || `https://s3.${WASABI_REGION}.wasabisys.com`;
const WASABI_RETENTION_DAYS = parseInt(process.env.WASABI_RETENTION_DAYS) || 14; // Keep 14 days of backups

// Initialize Wasabi S3 Client
let s3Client = null;
if (WASABI_ENABLED && WASABI_ACCESS_KEY_ID && WASABI_SECRET_ACCESS_KEY && WASABI_BUCKET_NAME) {
    s3Client = new S3Client({
        endpoint: WASABI_ENDPOINT,
        region: WASABI_REGION,
        credentials: {
            accessKeyId: WASABI_ACCESS_KEY_ID,
            secretAccessKey: WASABI_SECRET_ACCESS_KEY
        }
    });
    console.log('Wasabi S3 client initialized successfully');
} else if (WASABI_ENABLED) {
    console.warn('Wasabi is enabled but missing required credentials. Remote backup disabled.');
}

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
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
    const createItemsTableSQL = `
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
            sold_date TEXT,
            bought_price DECIMAL(10,2),
            sold_for_price DECIMAL(10,2),
            location TEXT,
            season TEXT,
            platform TEXT DEFAULT 'Vinted',
            collar_size TEXT,
            item_number TEXT
        );
    `;

    const createBrandsTableSQL = `
        CREATE TABLE IF NOT EXISTS brands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        );
    `;

    const createCollarSizesTableSQL = `
        CREATE TABLE IF NOT EXISTS collar_sizes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        );
    `;

    const createSizesTableSQL = `
        CREATE TABLE IF NOT EXISTS sizes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        );
    `;

    db.run(createItemsTableSQL, (err) => {
        if (err) {
            console.error('Error creating items table:', err.message);
        } else {
            console.log('Items table initialized successfully');
        }
    });

    db.run(createBrandsTableSQL, (err) => {
        if (err) {
            console.error('Error creating brands table:', err.message);
        } else {
            console.log('Brands table initialized successfully');
            addDefaultBrands();
        }
    });

    db.run(createCollarSizesTableSQL, (err) => {
        if (err) {
            console.error('Error creating collar_sizes table:', err.message);
        } else {
            console.log('Collar sizes table initialized successfully');
            addDefaultCollarSizes();
        }
    });

    db.run(createSizesTableSQL, (err) => {
        if (err) {
            console.error('Error creating sizes table:', err.message);
        } else {
            console.log('Sizes table initialized successfully');
            addDefaultSizes();
        }
    });

    // Add columns that might not exist in older databases
    addMissingColumns();
}

// Add default brands
function addDefaultBrands() {
    const defaultBrands = [
        'Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'Levi\'s', 'Gap', 'Forever 21',
        'Topshop', 'ASOS', 'Mango', 'Primark', 'New Look', 'Next', 'Marks & Spencer',
        'River Island', 'Urban Outfitters', 'Pull & Bear', 'Bershka', 'Stradivarius',
        'Calvin Klein', 'Ralph Lauren', 'Tommy Hilfiger', 'Puma', 'Under Armour',
        'New Balance', 'Converse', 'Vans', 'Boohoo', 'PrettyLittleThing'
    ];

    // Check if brands already exist to avoid unnecessary inserts
    db.get('SELECT COUNT(*) as count FROM brands', [], (err, result) => {
        if (err) {
            console.error('Error checking brands:', err.message);
            return;
        }

        // Only insert if we have fewer brands than defaults
        if (result.count < defaultBrands.length) {
            db.serialize(() => {
                const stmt = db.prepare('INSERT OR IGNORE INTO brands (name) VALUES (?)');
                defaultBrands.forEach(brandName => {
                    stmt.run(brandName, (err) => {
                        if (err && !err.message.includes('UNIQUE constraint failed')) {
                            console.error('Error adding default brand:', brandName, err.message);
                        }
                    });
                });
                stmt.finalize();
            });
        }
    });
}

// Add default collar sizes
function addDefaultCollarSizes() {
    const defaultCollarSizes = [
        '14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19', '19.5', '20'
    ];

    // Check if collar sizes already exist to avoid unnecessary inserts
    db.get('SELECT COUNT(*) as count FROM collar_sizes', [], (err, result) => {
        if (err) {
            console.error('Error checking collar sizes:', err.message);
            return;
        }

        // Only insert if we have fewer collar sizes than defaults
        if (result.count < defaultCollarSizes.length) {
            db.serialize(() => {
                const stmt = db.prepare('INSERT OR IGNORE INTO collar_sizes (name) VALUES (?)');
                defaultCollarSizes.forEach(sizeName => {
                    stmt.run(sizeName, (err) => {
                        if (err && !err.message.includes('UNIQUE constraint failed')) {
                            console.error('Error adding default collar size:', sizeName, err.message);
                        }
                    });
                });
                stmt.finalize();
            });
        }
    });
}

// Add default sizes
function addDefaultSizes() {
    const defaultSizes = [
        'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size'
    ];

    // Check if sizes already exist to avoid unnecessary inserts
    db.get('SELECT COUNT(*) as count FROM sizes', [], (err, result) => {
        if (err) {
            console.error('Error checking sizes:', err.message);
            return;
        }

        // Only insert if we have fewer sizes than defaults
        if (result.count < defaultSizes.length) {
            db.serialize(() => {
                const stmt = db.prepare('INSERT OR IGNORE INTO sizes (name) VALUES (?)');
                defaultSizes.forEach(sizeName => {
                    stmt.run(sizeName, (err) => {
                        if (err && !err.message.includes('UNIQUE constraint failed')) {
                            console.error('Error adding default size:', sizeName, err.message);
                        }
                    });
                });
                stmt.finalize();
            });
        }
    });
}

// Add missing columns for older databases
function addMissingColumns() {
    const columnsToAdd = [
        { column: 'is_sold', type: 'BOOLEAN DEFAULT 0' },
        { column: 'sold_date', type: 'TEXT' },
        { column: 'bought_price', type: 'DECIMAL(10,2)' },
        { column: 'sold_for_price', type: 'DECIMAL(10,2)' },
        { column: 'location', type: 'TEXT' },
        { column: 'season', type: 'TEXT' },
        { column: 'platform', type: 'TEXT DEFAULT "Vinted"' },
        { column: 'collar_size', type: 'TEXT' },
        { column: 'item_number', type: 'TEXT' }
    ];

    columnsToAdd.forEach(({ column, type }) => {
        db.run(`ALTER TABLE items ADD COLUMN ${column} ${type}`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`Error adding column ${column}:`, err.message);
            } else if (!err) {
                console.log(`Added column ${column} to items table`);
            }
        });
    });

    // Add is_active column to brands table
    db.run('ALTER TABLE brands ADD COLUMN is_active BOOLEAN DEFAULT 1', (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding is_active column to brands:', err.message);
        }
    });

    // Migrate selling_price to sold_for_price for existing databases
    db.all("PRAGMA table_info(items)", [], (err, columns) => {
        if (err) {
            console.error('Error checking table info:', err.message);
            return;
        }

        const hasSellingPrice = columns.some(col => col.name === 'selling_price');
        const hasSoldForPrice = columns.some(col => col.name === 'sold_for_price');

        if (hasSellingPrice && hasSoldForPrice) {
            // Both columns exist, copy data from old to new
            db.run('UPDATE items SET sold_for_price = selling_price WHERE sold_for_price IS NULL AND selling_price IS NOT NULL', (err) => {
                if (err) {
                    console.error('Error migrating selling_price data:', err.message);
                } else {
                    console.log('Successfully migrated selling_price to sold_for_price');
                }
            });
        }
    });
}

// ================================
// ITEM API ROUTES
// ================================

// Get all items
app.get('/api/items', (req, res) => {
    const { search, status } = req.query;
    let sql = 'SELECT * FROM items ORDER BY id DESC';
    let params = [];

    // Build WHERE conditions
    const conditions = [];
    
    if (status === 'sold') {
        conditions.push('is_sold = 1');
    } else if (status === 'available') {
        conditions.push('(is_sold = 0 OR is_sold IS NULL)');
    }

    if (search) {
        conditions.push('(name LIKE ? OR color LIKE ? OR size LIKE ? OR brand LIKE ? OR description LIKE ? OR location LIKE ?)');
        const searchValue = `%${search}%`;
        params.push(searchValue, searchValue, searchValue, searchValue, searchValue, searchValue);
    }

    if (conditions.length > 0) {
        sql = `SELECT * FROM items WHERE ${conditions.join(' AND ')} ORDER BY id DESC`;
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

// Create new item
app.post('/api/items', (req, res) => {
    const {
        name, color, size, brand, price, condition_item, description,
        bought_price, sold_for_price, location, season, platform, collar_size, item_number
    } = req.body;

    if (!name || !color || !size) {
        return res.status(400).json({ error: 'Name, color, and size are required' });
    }

    const dateAdded = new Date().toISOString().split('T')[0];

    const sql = `
        INSERT INTO items (
            name, color, size, brand, price, condition_item, description, date_added,
            bought_price, sold_for_price, location, season, platform, collar_size, item_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        name, color, size, brand || null, price || null, condition_item || null,
        description || null, dateAdded, bought_price || null, sold_for_price || null,
        location || null, season || null, platform || 'Vinted', collar_size || null, item_number || null
    ];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error creating item:', err.message);
            res.status(500).json({ error: 'Failed to create item' });
        } else {
            res.status(201).json({ 
                id: this.lastID,
                message: 'Item created successfully'
            });
        }
    });
});

// Update item
app.put('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Remove id from updates if present
    delete updates.id;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    const allowedFields = [
        'name', 'color', 'size', 'brand', 'price', 'condition_item', 'description',
        'bought_price', 'sold_for_price', 'location', 'season', 'platform', 'is_sold', 'sold_date', 'collar_size', 'item_number'
    ];

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);
    const sql = `UPDATE items SET ${fields.join(', ')} WHERE id = ?`;

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

// Mark item as sold/unsold
app.patch('/api/items/:id/sold', (req, res) => {
    const { id } = req.params;
    const { is_sold } = req.body;
    
    const soldDate = is_sold ? new Date().toISOString().split('T')[0] : null;
    
    db.run(
        'UPDATE items SET is_sold = ?, sold_date = ? WHERE id = ?',
        [is_sold ? 1 : 0, soldDate, id],
        function(err) {
            if (err) {
                console.error('Error updating item status:', err.message);
                res.status(500).json({ error: 'Failed to update item status' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Item not found' });
            } else {
                res.json({ 
                    message: `Item marked as ${is_sold ? 'sold' : 'available'}`,
                    is_sold: is_sold,
                    sold_date: soldDate
                });
            }
        }
    );
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

// ================================
// BRAND API ROUTES
// ================================

// Get all active brands for dropdown
app.get('/api/brands', (req, res) => {
    db.all(
        'SELECT id, name FROM brands WHERE is_active = 1 ORDER BY name ASC',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching brands:', err.message);
                res.status(500).json({ error: 'Failed to fetch brands' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Get all brands (including inactive) for management
app.get('/api/brands/all', (req, res) => {
    db.all(
        'SELECT id, name, is_active, created_at FROM brands ORDER BY name ASC',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching all brands:', err.message);
                res.status(500).json({ error: 'Failed to fetch brands' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Add new brand
app.post('/api/brands', (req, res) => {
    const { name, is_active = true } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Brand name is required' });
    }

    const trimmedName = name.trim();
    
    // Check if brand already exists
    db.get('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)', [trimmedName], (err, existing) => {
        if (err) {
            console.error('Error checking existing brand:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
            return res.status(409).json({ error: 'Brand already exists' });
        }

        // Insert new brand
        db.run(
            'INSERT INTO brands (name, is_active) VALUES (?, ?)',
            [trimmedName, is_active ? 1 : 0],
            function(err) {
                if (err) {
                    console.error('Error adding brand:', err.message);
                    res.status(500).json({ error: 'Failed to add brand' });
                } else {
                    // Return the new brand
                    db.get('SELECT * FROM brands WHERE id = ?', [this.lastID], (err, newBrand) => {
                        if (err) {
                            console.error('Error fetching new brand:', err.message);
                            res.status(500).json({ error: 'Brand created but failed to fetch' });
                        } else {
                            res.status(201).json(newBrand);
                        }
                    });
                }
            }
        );
    });
});

// Update brand (activate/deactivate or rename)
app.put('/api/brands/:id', (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
        const trimmedName = name.trim();
        if (trimmedName === '') {
            return res.status(400).json({ error: 'Brand name cannot be empty' });
        }
        
        // Check if another brand has this name
        db.get(
            'SELECT id FROM brands WHERE LOWER(name) = LOWER(?) AND id != ?',
            [trimmedName, id],
            (err, existing) => {
                if (err) {
                    console.error('Error checking duplicate brand name:', err.message);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (existing) {
                    return res.status(409).json({ error: 'Brand name already exists' });
                }
                
                // Continue with update
                performBrandUpdate();
            }
        );
        
        updates.push('name = ?');
        params.push(trimmedName);
    } else {
        performBrandUpdate();
    }

    function performBrandUpdate() {
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);
        
        db.run(
            `UPDATE brands SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) {
                    console.error('Error updating brand:', err.message);
                    res.status(500).json({ error: 'Failed to update brand' });
                } else if (this.changes === 0) {
                    res.status(404).json({ error: 'Brand not found' });
                } else {
                    // Return updated brand
                    db.get('SELECT * FROM brands WHERE id = ?', [id], (err, updatedBrand) => {
                        if (err) {
                            console.error('Error fetching updated brand:', err.message);
                            res.status(500).json({ error: 'Brand updated but failed to fetch' });
                        } else {
                            res.json(updatedBrand);
                        }
                    });
                }
            }
        );
    }
});

// Delete brand (only if not used by any items)
app.delete('/api/brands/:id', (req, res) => {
    const { id } = req.params;

    // Check if brand is used by any items
    db.get(
        'SELECT COUNT(*) as count FROM items WHERE brand = (SELECT name FROM brands WHERE id = ?)',
        [id],
        (err, result) => {
            if (err) {
                console.error('Error checking brand usage:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }

            if (result.count > 0) {
                return res.status(409).json({ 
                    error: `Cannot delete brand. It is used by ${result.count} item(s). Consider deactivating instead.` 
                });
            }

            // Safe to delete
            db.run('DELETE FROM brands WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('Error deleting brand:', err.message);
                    res.status(500).json({ error: 'Failed to delete brand' });
                } else if (this.changes === 0) {
                    res.status(404).json({ error: 'Brand not found' });
                } else {
                    res.json({ message: 'Brand deleted successfully' });
                }
            });
        }
    );
});

// ================================
// COLLAR SIZE API ROUTES
// ================================

// Get all active collar sizes for dropdown
app.get('/api/collar-sizes', (req, res) => {
    db.all(
        'SELECT id, name FROM collar_sizes WHERE is_active = 1 ORDER BY CAST(name AS REAL) ASC',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching collar sizes:', err.message);
                res.status(500).json({ error: 'Failed to fetch collar sizes' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Get all collar sizes (including inactive) for management
app.get('/api/collar-sizes/all', (req, res) => {
    db.all(
        'SELECT id, name, is_active, created_at FROM collar_sizes ORDER BY CAST(name AS REAL) ASC',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching all collar sizes:', err.message);
                res.status(500).json({ error: 'Failed to fetch collar sizes' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Add new collar size
app.post('/api/collar-sizes', (req, res) => {
    const { name, is_active = true } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Collar size name is required' });
    }

    const trimmedName = name.trim();

    // Check if collar size already exists
    db.get('SELECT id FROM collar_sizes WHERE LOWER(name) = LOWER(?)', [trimmedName], (err, existing) => {
        if (err) {
            console.error('Error checking existing collar size:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existing) {
            return res.status(409).json({ error: 'Collar size already exists' });
        }

        // Insert new collar size
        db.run(
            'INSERT INTO collar_sizes (name, is_active) VALUES (?, ?)',
            [trimmedName, is_active ? 1 : 0],
            function(err) {
                if (err) {
                    console.error('Error adding collar size:', err.message);
                    res.status(500).json({ error: 'Failed to add collar size' });
                } else {
                    // Return the new collar size
                    db.get('SELECT * FROM collar_sizes WHERE id = ?', [this.lastID], (err, newSize) => {
                        if (err) {
                            console.error('Error fetching new collar size:', err.message);
                            res.status(500).json({ error: 'Collar size created but failed to fetch' });
                        } else {
                            res.status(201).json(newSize);
                        }
                    });
                }
            }
        );
    });
});

// Update collar size (activate/deactivate or rename)
app.put('/api/collar-sizes/:id', (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
        const trimmedName = name.trim();
        if (trimmedName === '') {
            return res.status(400).json({ error: 'Collar size name cannot be empty' });
        }

        // Check if another collar size has this name
        db.get(
            'SELECT id FROM collar_sizes WHERE LOWER(name) = LOWER(?) AND id != ?',
            [trimmedName, id],
            (err, existing) => {
                if (err) {
                    console.error('Error checking duplicate collar size name:', err.message);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (existing) {
                    return res.status(409).json({ error: 'Collar size name already exists' });
                }

                // Continue with update
                performCollarSizeUpdate();
            }
        );

        updates.push('name = ?');
        params.push(trimmedName);
    } else {
        performCollarSizeUpdate();
    }

    function performCollarSizeUpdate() {
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);

        db.run(
            `UPDATE collar_sizes SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) {
                    console.error('Error updating collar size:', err.message);
                    res.status(500).json({ error: 'Failed to update collar size' });
                } else if (this.changes === 0) {
                    res.status(404).json({ error: 'Collar size not found' });
                } else {
                    // Return updated collar size
                    db.get('SELECT * FROM collar_sizes WHERE id = ?', [id], (err, updatedSize) => {
                        if (err) {
                            console.error('Error fetching updated collar size:', err.message);
                            res.status(500).json({ error: 'Collar size updated but failed to fetch' });
                        } else {
                            res.json(updatedSize);
                        }
                    });
                }
            }
        );
    }
});

// Delete collar size (only if not used by any items)
app.delete('/api/collar-sizes/:id', (req, res) => {
    const { id } = req.params;

    // Check if collar size is used by any items
    db.get(
        'SELECT COUNT(*) as count FROM items WHERE collar_size = (SELECT name FROM collar_sizes WHERE id = ?)',
        [id],
        (err, result) => {
            if (err) {
                console.error('Error checking collar size usage:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }

            if (result.count > 0) {
                return res.status(409).json({
                    error: `Cannot delete collar size. It is used by ${result.count} item(s). Consider deactivating instead.`
                });
            }

            // Safe to delete
            db.run('DELETE FROM collar_sizes WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('Error deleting collar size:', err.message);
                    res.status(500).json({ error: 'Failed to delete collar size' });
                } else if (this.changes === 0) {
                    res.status(404).json({ error: 'Collar size not found' });
                } else {
                    res.json({ message: 'Collar size deleted successfully' });
                }
            });
        }
    );
});

// ================================
// SIZE API ROUTES
// ================================

// Get all active sizes for dropdown
app.get('/api/sizes', (req, res) => {
    db.all(
        'SELECT id, name FROM sizes WHERE is_active = 1 ORDER BY name ASC',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching sizes:', err.message);
                res.status(500).json({ error: 'Failed to fetch sizes' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Get all sizes (including inactive) for management
app.get('/api/sizes/all', (req, res) => {
    db.all(
        'SELECT id, name, is_active, created_at FROM sizes ORDER BY name ASC',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching all sizes:', err.message);
                res.status(500).json({ error: 'Failed to fetch sizes' });
            } else {
                res.json(rows);
            }
        }
    );
});

// Add new size
app.post('/api/sizes', (req, res) => {
    const { name, is_active = true } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Size name is required' });
    }

    const trimmedName = name.trim();

    // Check if size already exists
    db.get('SELECT id FROM sizes WHERE LOWER(name) = LOWER(?)', [trimmedName], (err, existing) => {
        if (err) {
            console.error('Error checking existing size:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existing) {
            return res.status(409).json({ error: 'Size already exists' });
        }

        // Insert new size
        db.run(
            'INSERT INTO sizes (name, is_active) VALUES (?, ?)',
            [trimmedName, is_active ? 1 : 0],
            function(err) {
                if (err) {
                    console.error('Error adding size:', err.message);
                    res.status(500).json({ error: 'Failed to add size' });
                } else {
                    // Return the new size
                    db.get('SELECT * FROM sizes WHERE id = ?', [this.lastID], (err, newSize) => {
                        if (err) {
                            console.error('Error fetching new size:', err.message);
                            res.status(500).json({ error: 'Size created but failed to fetch' });
                        } else {
                            res.status(201).json(newSize);
                        }
                    });
                }
            }
        );
    });
});

// Update size (activate/deactivate or rename)
app.put('/api/sizes/:id', (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
        const trimmedName = name.trim();
        if (trimmedName === '') {
            return res.status(400).json({ error: 'Size name cannot be empty' });
        }

        // Check if another size has this name
        db.get(
            'SELECT id FROM sizes WHERE LOWER(name) = LOWER(?) AND id != ?',
            [trimmedName, id],
            (err, existing) => {
                if (err) {
                    console.error('Error checking duplicate size name:', err.message);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (existing) {
                    return res.status(409).json({ error: 'Size name already exists' });
                }

                // Continue with update
                performSizeUpdate();
            }
        );

        updates.push('name = ?');
        params.push(trimmedName);
    } else {
        performSizeUpdate();
    }

    function performSizeUpdate() {
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);

        db.run(
            `UPDATE sizes SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) {
                    console.error('Error updating size:', err.message);
                    res.status(500).json({ error: 'Failed to update size' });
                } else if (this.changes === 0) {
                    res.status(404).json({ error: 'Size not found' });
                } else {
                    // Return updated size
                    db.get('SELECT * FROM sizes WHERE id = ?', [id], (err, updatedSize) => {
                        if (err) {
                            console.error('Error fetching updated size:', err.message);
                            res.status(500).json({ error: 'Size updated but failed to fetch' });
                        } else {
                            res.json(updatedSize);
                        }
                    });
                }
            }
        );
    }
});

// Delete size (only if not used by any items)
app.delete('/api/sizes/:id', (req, res) => {
    const { id } = req.params;

    // Check if size is used by any items
    db.get(
        'SELECT COUNT(*) as count FROM items WHERE size = (SELECT name FROM sizes WHERE id = ?)',
        [id],
        (err, result) => {
            if (err) {
                console.error('Error checking size usage:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }

            if (result.count > 0) {
                return res.status(409).json({
                    error: `Cannot delete size. It is used by ${result.count} item(s). Consider deactivating instead.`
                });
            }

            // Safe to delete
            db.run('DELETE FROM sizes WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('Error deleting size:', err.message);
                    res.status(500).json({ error: 'Failed to delete size' });
                } else if (this.changes === 0) {
                    res.status(404).json({ error: 'Size not found' });
                } else {
                    res.json({ message: 'Size deleted successfully' });
                }
            });
        }
    );
});

// ================================
// STATISTICS AND REPORTS
// ================================

// Get inventory statistics
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    // Get total items count
    db.get('SELECT COUNT(*) as count FROM items', [], (err, result) => {
        if (err) {
            console.error('Error getting total items:', err.message);
            return res.status(500).json({ error: 'Failed to get statistics' });
        }
        stats.totalItems = result.count;
        
        // Get sold items count
        db.get('SELECT COUNT(*) as count FROM items WHERE is_sold = 1', [], (err, result) => {
            if (err) {
                console.error('Error getting sold items:', err.message);
                return res.status(500).json({ error: 'Failed to get statistics' });
            }
            stats.soldItems = result.count;
            stats.activeItems = stats.totalItems - stats.soldItems;
            
            // Get active listings value (sum of selling prices for unsold items)
            db.get('SELECT SUM(COALESCE(sold_for_price, price, 0)) as total FROM items WHERE (is_sold = 0 OR is_sold IS NULL)', [], (err, result) => {
                if (err) {
                    console.error('Error getting total value:', err.message);
                    return res.status(500).json({ error: 'Failed to get statistics' });
                }
                stats.totalValue = (parseFloat(result.total) || 0).toFixed(2);
                
                // Get profit calculation
                db.get(`
                    SELECT
                        SUM(COALESCE(sold_for_price, price, 0) - COALESCE(bought_price, 0)) as profit
                    FROM items
                    WHERE is_sold = 1 AND bought_price IS NOT NULL
                `, [], (err, result) => {
                    if (err) {
                        console.error('Error getting profit:', err.message);
                        return res.status(500).json({ error: 'Failed to get statistics' });
                    }
                    stats.profit = (parseFloat(result.profit) || 0).toFixed(2);
                    
                    // Get brands count
                    db.get('SELECT COUNT(*) as count FROM brands WHERE is_active = 1', [], (err, result) => {
                        if (err) {
                            console.error('Error getting brands count:', err.message);
                            return res.status(500).json({ error: 'Failed to get statistics' });
                        }
                        stats.totalBrands = result.count;
                        
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// ================================
// CLEANUP AND MAINTENANCE ROUTES
// ================================

// Delete all sold items
app.delete('/api/cleanup/sold', (req, res) => {
    db.run('DELETE FROM items WHERE is_sold = 1', [], function(err) {
        if (err) {
            console.error('Error deleting sold items:', err.message);
            res.status(500).json({ error: 'Failed to delete sold items' });
        } else {
            res.json({ 
                message: 'Sold items deleted successfully',
                deletedCount: this.changes
            });
        }
    });
});

// Remove duplicate items (based on name, color, size, brand)
app.delete('/api/cleanup/duplicates', (req, res) => {
    const findDuplicatesSQL = `
        DELETE FROM items 
        WHERE id NOT IN (
            SELECT MIN(id) 
            FROM items 
            GROUP BY name, color, size, COALESCE(brand, '')
        )
    `;
    
    db.run(findDuplicatesSQL, [], function(err) {
        if (err) {
            console.error('Error removing duplicates:', err.message);
            res.status(500).json({ error: 'Failed to remove duplicates' });
        } else {
            res.json({ 
                message: 'Duplicate items removed successfully',
                removedCount: this.changes
            });
        }
    });
});

// Reset entire database (delete all items and reset brands to defaults)
app.delete('/api/cleanup/reset', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM items', [], function(err) {
            if (err) {
                console.error('Error deleting all items:', err.message);
                return res.status(500).json({ error: 'Failed to reset database' });
            }
            
            // Reset auto-increment counter
            db.run('DELETE FROM sqlite_sequence WHERE name="items"', [], (err) => {
                if (err) {
                    console.error('Error resetting item counter:', err.message);
                }
            });
            
            // Delete all brands and re-add defaults
            db.run('DELETE FROM brands', [], function(err) {
                if (err) {
                    console.error('Error deleting brands:', err.message);
                    return res.status(500).json({ error: 'Failed to reset brands' });
                }
                
                // Reset brands auto-increment counter
                db.run('DELETE FROM sqlite_sequence WHERE name="brands"', [], (err) => {
                    if (err) {
                        console.error('Error resetting brands counter:', err.message);
                    }
                });
                
                // Re-add default brands
                addDefaultBrands();
                
                res.json({ 
                    message: 'Database reset successfully',
                    itemsDeleted: this.changes
                });
            });
        });
    });
});

// Optimize database (VACUUM and ANALYZE)
app.post('/api/maintenance/optimize', (req, res) => {
    db.serialize(() => {
        db.run('VACUUM', [], (err) => {
            if (err) {
                console.error('Error running VACUUM:', err.message);
                return res.status(500).json({ error: 'Failed to optimize database' });
            }
            
            db.run('ANALYZE', [], (err) => {
                if (err) {
                    console.error('Error running ANALYZE:', err.message);
                    return res.status(500).json({ error: 'Failed to analyze database' });
                }
                
                res.json({ message: 'Database optimized successfully' });
            });
        });
    });
});

// Repair database (integrity check and rebuild if necessary)
app.post('/api/maintenance/repair', (req, res) => {
    db.get('PRAGMA integrity_check', [], (err, result) => {
        if (err) {
            console.error('Error checking database integrity:', err.message);
            return res.status(500).json({ error: 'Failed to check database integrity' });
        }
        
        if (result && result.integrity_check === 'ok') {
            res.json({ 
                message: 'Database integrity check passed - no repair needed',
                status: 'healthy'
            });
        } else {
            // If integrity check fails, try to rebuild indexes
            db.run('REINDEX', [], (err) => {
                if (err) {
                    console.error('Error rebuilding indexes:', err.message);
                    return res.status(500).json({ error: 'Failed to repair database' });
                }
                
                res.json({ 
                    message: 'Database indexes rebuilt successfully',
                    status: 'repaired'
                });
            });
        }
    });
});

// Get cleanup statistics (items that would be affected by cleanup operations)
app.get('/api/cleanup/stats', (req, res) => {
    const stats = {};
    
    // Count sold items
    db.get('SELECT COUNT(*) as count FROM items WHERE is_sold = 1', [], (err, result) => {
        if (err) {
            console.error('Error counting sold items:', err.message);
            return res.status(500).json({ error: 'Failed to get cleanup stats' });
        }
        stats.soldItems = result.count;
        
        // Count potential duplicates
        db.get(`
            SELECT COUNT(*) - COUNT(DISTINCT name, color, size, COALESCE(brand, '')) as duplicates
            FROM items
        `, [], (err, result) => {
            if (err) {
                console.error('Error counting duplicates:', err.message);
                return res.status(500).json({ error: 'Failed to get cleanup stats' });
            }
            stats.duplicateItems = result.duplicates;
            
            // Get database size info
            db.get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()', [], (err, result) => {
                if (err) {
                    console.error('Error getting database size:', err.message);
                    stats.databaseSize = 'Unknown';
                } else {
                    stats.databaseSize = `${(result.size / 1024 / 1024).toFixed(2)} MB`;
                }
                
                res.json(stats);
            });
        });
    });
});

// ================================
// BACKUP AND IMPORT/EXPORT ROUTES
// ================================

// Backup directory
const BACKUP_DIR = path.join(dataDir, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function safeBackupPath(filename) {
    const safe = path.basename(filename);
    if (!safe.endsWith('.db') || safe !== filename) return null;
    return path.join(BACKUP_DIR, safe);
}

// Create manual backup
app.post('/api/backups/create', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-manual-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Copy database file
    fs.copyFile(DB_PATH, backupPath, async (err) => {
        if (err) {
            console.error('Error creating backup:', err.message);
            return res.status(500).json({ error: 'Failed to create backup' });
        }

        const fileSize = fs.statSync(backupPath).size;
        let wasabiUploaded = false;

        // Upload to Wasabi if configured
        if (WASABI_ENABLED) {
            wasabiUploaded = await uploadToWasabi(backupPath, backupFileName);
        }

        res.json({
            message: 'Backup created successfully',
            filename: backupFileName,
            size: fileSize,
            uploadedToWasabi: wasabiUploaded
        });
    });
});

// List all backups
app.get('/api/backups', (req, res) => {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) {
            console.error('Error reading backup directory:', err.message);
            return res.status(500).json({ error: 'Failed to list backups' });
        }

        const backups = files
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                const isAuto = file.includes('auto');

                return {
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    type: isAuto ? 'automated' : 'manual'
                };
            })
            .sort((a, b) => b.created - a.created);

        res.json(backups);
    });
});

// Download backup
app.get('/api/backups/download/:filename', (req, res) => {
    const backupPath = safeBackupPath(req.params.filename);
    if (!backupPath) return res.status(400).json({ error: 'Invalid filename' });

    if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup not found' });
    }

    res.download(backupPath, req.params.filename, (err) => {
        if (err) {
            console.error('Error downloading backup:', err.message);
            res.status(500).json({ error: 'Failed to download backup' });
        }
    });
});

// Delete backup
app.delete('/api/backups/:filename', (req, res) => {
    const backupPath = safeBackupPath(req.params.filename);
    if (!backupPath) return res.status(400).json({ error: 'Invalid filename' });

    if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup not found' });
    }

    fs.unlink(backupPath, (err) => {
        if (err) {
            console.error('Error deleting backup:', err.message);
            return res.status(500).json({ error: 'Failed to delete backup' });
        }

        res.json({ message: 'Backup deleted successfully' });
    });
});

// Restore backup
app.post('/api/backups/:filename/restore', (req, res) => {
    const { filename } = req.params;
    const backupPath = safeBackupPath(filename);
    if (!backupPath) return res.status(400).json({ error: 'Invalid filename' });

    // Validate backup file exists
    if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup file not found' });
    }

    console.log(`Starting restore process from backup: ${filename}`);

    // Create a safety backup of the current database
    const safetyBackupPath = path.join(BACKUP_DIR, `safety-backup-${Date.now()}.db`);

    fs.copyFile(DB_PATH, safetyBackupPath, (copyErr) => {
        if (copyErr) {
            console.error('Error creating safety backup:', copyErr.message);
            return res.status(500).json({ error: 'Failed to create safety backup before restore' });
        }

        console.log('Safety backup created:', safetyBackupPath);

        // Close current database connection
        db.close((closeErr) => {
            if (closeErr) {
                console.error('Error closing database:', closeErr.message);
                return res.status(500).json({ error: 'Failed to close database connection' });
            }

            console.log('Database connection closed');

            // Replace current database with backup
            fs.copyFile(backupPath, DB_PATH, (restoreErr) => {
                if (restoreErr) {
                    console.error('Error restoring backup:', restoreErr.message);

                    // Try to restore the safety backup
                    fs.copyFile(safetyBackupPath, DB_PATH, (rollbackErr) => {
                        if (rollbackErr) {
                            console.error('CRITICAL: Failed to rollback to safety backup:', rollbackErr.message);
                        }

                        // Reopen the database (either restored safety backup or original if rollback failed)
                        reopenDatabase();
                        return res.status(500).json({ error: 'Failed to restore backup. Database rolled back to previous state.' });
                    });
                    return;
                }

                console.log('Database file replaced with backup');

                // Reopen database connection
                reopenDatabase();

                // Test the restored database
                setTimeout(() => {
                    db.get('SELECT COUNT(*) as count FROM items', [], (testErr, result) => {
                        if (testErr) {
                            console.error('Error testing restored database:', testErr.message);

                            // Restore safety backup
                            db.close(() => {
                                fs.copyFile(safetyBackupPath, DB_PATH, (rollbackErr) => {
                                    if (rollbackErr) {
                                        console.error('CRITICAL: Failed to rollback:', rollbackErr.message);
                                    }
                                    reopenDatabase();
                                });
                            });

                            return res.status(500).json({ error: 'Restored database is corrupted. Rolled back to previous state.' });
                        }

                        console.log(`Database restored successfully. Contains ${result.count} items.`);

                        // Clean up safety backup after 5 minutes (give time to verify restore worked)
                        setTimeout(() => {
                            fs.unlink(safetyBackupPath, (unlinkErr) => {
                                if (unlinkErr) {
                                    console.error('Error deleting safety backup:', unlinkErr.message);
                                } else {
                                    console.log('Safety backup cleaned up');
                                }
                            });
                        }, 5 * 60 * 1000);

                        res.json({
                            message: 'Database restored successfully',
                            filename: filename,
                            itemCount: result.count,
                            safetyBackup: path.basename(safetyBackupPath)
                        });
                    });
                }, 500); // Give database time to fully initialize
            });
        });
    });
});

// Helper function to reopen database connection
function reopenDatabase() {
    const sqlite3 = require('sqlite3').verbose();
    const newDb = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error reopening database:', err.message);
        } else {
            console.log('Database connection reopened');
        }
    });

    // Replace global db object
    Object.assign(db, newDb);
}

// Upload existing backup to Wasabi
app.post('/api/backups/:filename/upload-to-wasabi', async (req, res) => {
    if (!WASABI_ENABLED) {
        return res.status(400).json({ error: 'Wasabi integration is not enabled' });
    }

    const { filename } = req.params;
    const backupPath = safeBackupPath(filename);
    if (!backupPath) return res.status(400).json({ error: 'Invalid filename' });

    if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup not found' });
    }

    try {
        const success = await uploadToWasabi(backupPath, filename);

        if (success) {
            res.json({
                message: 'Backup uploaded to Wasabi successfully',
                filename: filename
            });
        } else {
            res.status(500).json({ error: 'Failed to upload backup to Wasabi' });
        }
    } catch (error) {
        console.error('Error uploading backup to Wasabi:', error);
        res.status(500).json({ error: 'Failed to upload backup to Wasabi' });
    }
});

// List backups on Wasabi
app.get('/api/backups/wasabi/list', async (req, res) => {
    if (!WASABI_ENABLED) {
        return res.status(400).json({ error: 'Wasabi integration is not enabled' });
    }

    if (!s3Client) {
        return res.status(500).json({ error: 'Wasabi S3 client not configured' });
    }

    try {
        const listParams = {
            Bucket: WASABI_BUCKET_NAME,
            Prefix: 'backups/'
        };

        const command = new ListObjectsV2Command(listParams);
        const data = await s3Client.send(command);

        const backups = (data.Contents || []).map(item => ({
            filename: item.Key.replace('backups/', ''),
            size: item.Size,
            lastModified: item.LastModified
        }));

        res.json(backups);
    } catch (error) {
        console.error('Error listing Wasabi backups:', error);
        res.status(500).json({ error: 'Failed to list Wasabi backups' });
    }
});

// Upload backup to Wasabi S3
async function uploadToWasabi(filePath, fileName) {
    if (!s3Client) {
        console.log('Wasabi S3 client not configured. Skipping remote backup.');
        return false;
    }

    try {
        const fileStream = fs.createReadStream(filePath);
        const fileStats = fs.statSync(filePath);

        const uploadParams = {
            Bucket: WASABI_BUCKET_NAME,
            Key: `backups/${fileName}`,
            Body: fileStream,
            ContentLength: fileStats.size,
            ContentType: 'application/x-sqlite3'
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        console.log(`Successfully uploaded ${fileName} to Wasabi`);
        return true;
    } catch (error) {
        console.error('Error uploading to Wasabi:', error.message);
        return false;
    }
}

// Cleanup old Wasabi backups (keep only backups within retention period)
async function cleanupOldWasabiBackups() {
    if (!s3Client) {
        console.log('Wasabi S3 client not configured. Skipping remote backup cleanup.');
        return;
    }

    try {
        // List all backups in Wasabi
        const listParams = {
            Bucket: WASABI_BUCKET_NAME,
            Prefix: 'backups/'
        };

        const listCommand = new ListObjectsV2Command(listParams);
        const data = await s3Client.send(listCommand);

        if (!data.Contents || data.Contents.length === 0) {
            console.log('No Wasabi backups found to cleanup');
            return;
        }

        // Calculate cutoff date (backups older than retention period)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - WASABI_RETENTION_DAYS);

        // Filter backups older than retention period
        const backupsToDelete = data.Contents.filter(item => {
            return item.LastModified < cutoffDate;
        });

        if (backupsToDelete.length === 0) {
            console.log(`No Wasabi backups older than ${WASABI_RETENTION_DAYS} days to cleanup`);
            return;
        }

        console.log(`Cleaning up ${backupsToDelete.length} old Wasabi backup(s)...`);

        // Delete old backups
        for (const backup of backupsToDelete) {
            try {
                const deleteParams = {
                    Bucket: WASABI_BUCKET_NAME,
                    Key: backup.Key
                };

                const deleteCommand = new DeleteObjectCommand(deleteParams);
                await s3Client.send(deleteCommand);

                const fileName = backup.Key.replace('backups/', '');
                const age = Math.floor((new Date() - backup.LastModified) / (1000 * 60 * 60 * 24));
                console.log(`Deleted old Wasabi backup: ${fileName} (${age} days old)`);
            } catch (deleteError) {
                console.error(`Error deleting Wasabi backup ${backup.Key}:`, deleteError.message);
            }
        }

        console.log(`Wasabi backup cleanup completed. Deleted ${backupsToDelete.length} old backup(s).`);
    } catch (error) {
        console.error('Error during Wasabi backup cleanup:', error.message);
    }
}

// Automated backup function
function createAutomatedBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-auto-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    fs.copyFile(DB_PATH, backupPath, async (err) => {
        if (err) {
            console.error('Error creating automated backup:', err.message);
        } else {
            console.log('Automated backup created:', backupFileName);

            // Upload to Wasabi if configured
            if (WASABI_ENABLED) {
                await uploadToWasabi(backupPath, backupFileName);
                // Cleanup old Wasabi backups
                await cleanupOldWasabiBackups();
            }

            cleanupOldBackups();
        }
    });
}

// Cleanup old automated backups (keep last 7)
function cleanupOldBackups() {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) {
            console.error('Error reading backup directory:', err.message);
            return;
        }

        const autoBackups = files
            .filter(file => file.includes('auto') && file.endsWith('.db'))
            .map(file => ({
                filename: file,
                path: path.join(BACKUP_DIR, file),
                created: fs.statSync(path.join(BACKUP_DIR, file)).birthtime
            }))
            .sort((a, b) => b.created - a.created);

        // Delete backups beyond the 7th one
        if (autoBackups.length > 7) {
            autoBackups.slice(7).forEach(backup => {
                fs.unlink(backup.path, (err) => {
                    if (err) {
                        console.error('Error deleting old backup:', err.message);
                    } else {
                        console.log('Deleted old backup:', backup.filename);
                    }
                });
            });
        }
    });
}

// Schedule automated daily backup at 3 AM
cron.schedule('0 3 * * *', () => {
    console.log('Running automated backup...');
    createAutomatedBackup();
});

// Export JSON
app.get('/api/export/json', (req, res) => {
    db.all('SELECT * FROM items ORDER BY id DESC', [], (err, rows) => {
        if (err) {
            console.error('Error exporting JSON:', err.message);
            res.status(500).json({ error: 'Failed to export JSON' });
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="inventory-export-${new Date().toISOString().split('T')[0]}.json"`);
            res.send(JSON.stringify(rows, null, 2));
        }
    });
});

// Export Excel
app.get('/api/export/excel', (req, res) => {
    db.all('SELECT * FROM items ORDER BY id DESC', [], (err, rows) => {
        if (err) {
            console.error('Error exporting Excel:', err.message);
            return res.status(500).json({ error: 'Failed to export Excel' });
        }

        // Format data for Excel
        const formattedData = rows.map(item => ({
            'ID': item.id,
            'Name': item.name,
            'Color': item.color,
            'Size': item.size,
            'Collar Size': item.collar_size || '',
            'Brand': item.brand || '',
            'Bought Price': item.bought_price || '',
            'Sold For Price': item.sold_for_price || item.price || '',
            'Condition': item.condition_item || '',
            'Location': item.location || '',
            'Season': item.season || '',
            'Platform': item.platform || 'Vinted',
            'Status': item.is_sold ? 'SOLD' : 'AVAILABLE',
            'Date Added': item.date_added || '',
            'Sold Date': item.sold_date || '',
            'Description': item.description || ''
        }));

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(formattedData);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 5 },   // ID
            { wch: 30 },  // Name
            { wch: 15 },  // Color
            { wch: 10 },  // Size
            { wch: 12 },  // Collar Size
            { wch: 20 },  // Brand
            { wch: 12 },  // Bought Price
            { wch: 12 },  // Selling Price
            { wch: 15 },  // Condition
            { wch: 15 },  // Location
            { wch: 12 },  // Season
            { wch: 12 },  // Platform
            { wch: 10 },  // Status
            { wch: 12 },  // Date Added
            { wch: 12 },  // Sold Date
            { wch: 40 }   // Description
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="inventory-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buffer);
    });
});

// Import CSV/JSON
app.post('/api/import', (req, res) => {
    const { data, format } = req.body;

    if (!data || !format) {
        return res.status(400).json({ error: 'Data and format are required' });
    }

    let items = [];

    try {
        if (format === 'json') {
            items = JSON.parse(data);
        } else if (format === 'csv') {
            // Parse CSV manually (simple implementation)
            const lines = data.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
                const item = {};

                headers.forEach((header, index) => {
                    if (values[index]) {
                        item[header] = values[index].trim().replace(/^"|"$/g, '').replace(/""/g, '"');
                    }
                });

                items.push(item);
            }
        } else {
            return res.status(400).json({ error: 'Unsupported format. Use json or csv' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No valid items found in data' });
        }

        // Insert items
        let insertedCount = 0;
        let errorCount = 0;

        const stmt = db.prepare(`
            INSERT INTO items (
                name, color, size, brand, price, condition_item, description, date_added,
                bought_price, sold_for_price, location, season, platform, is_sold, sold_date, collar_size
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        items.forEach(item => {
            const dateAdded = item.date_added || item['Date Added'] || new Date().toISOString().split('T')[0];
            const name = item.name || item.Name;
            const color = item.color || item.Color;
            const size = item.size || item.Size;

            if (!name || !color || !size) {
                errorCount++;
                return;
            }

            stmt.run(
                name,
                color,
                size,
                item.brand || item.Brand || null,
                item.price || null,
                item.condition_item || item.Condition || null,
                item.description || item.Description || null,
                dateAdded,
                item.bought_price || item['Bought Price'] || null,
                item.sold_for_price || item['Sold For Price'] || null,
                item.location || item.Location || null,
                item.season || item.Season || null,
                item.platform || item.Platform || 'Vinted',
                (item.is_sold || item.Status === 'SOLD') ? 1 : 0,
                item.sold_date || item['Sold Date'] || null,
                item.collar_size || item['Collar Size'] || null,
                (err) => {
                    if (err) {
                        console.error('Error inserting item:', err.message);
                        errorCount++;
                    } else {
                        insertedCount++;
                    }
                }
            );
        });

        stmt.finalize(() => {
            res.json({
                message: 'Import completed',
                inserted: insertedCount,
                errors: errorCount,
                total: items.length
            });
        });

    } catch (error) {
        console.error('Error parsing import data:', error.message);
        res.status(400).json({ error: 'Invalid data format: ' + error.message });
    }
});

// ================================
// EXPORT ROUTES
// ================================

// Export CSV
app.get('/api/export/csv', (req, res) => {
    db.all('SELECT * FROM items ORDER BY id DESC', [], (err, rows) => {
        if (err) {
            console.error('Error exporting CSV:', err.message);
            res.status(500).json({ error: 'Failed to export CSV' });
        } else {
            const csvHeader = 'ID,Name,Color,Size,Brand,Bought Price,Sold For Price,Condition,Location,Season,Platform,Status,Date Added,Sold Date,Description\n';
            const csvRows = rows.map(item => {
                const status = item.is_sold ? 'SOLD' : 'AVAILABLE';
                const boughtPrice = item.bought_price || '';
                const sellingPrice = item.sold_for_price || item.price || '';
                
                return [
                    item.id,
                    `"${(item.name || '').replace(/"/g, '""')}"`,
                    `"${(item.color || '').replace(/"/g, '""')}"`,
                    `"${(item.size || '').replace(/"/g, '""')}"`,
                    `"${(item.brand || '').replace(/"/g, '""')}"`,
                    boughtPrice,
                    sellingPrice,
                    `"${(item.condition_item || '').replace(/"/g, '""')}"`,
                    `"${(item.location || '').replace(/"/g, '""')}"`,
                    `"${(item.season || '').replace(/"/g, '""')}"`,
                    `"${(item.platform || 'Vinted').replace(/"/g, '""')}"`,
                    status,
                    `"${item.date_added || ''}"`,
                    `"${item.sold_date || ''}"`,
                    `"${(item.description || '').replace(/"/g, '""')}"`
                ].join(',');
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="inventory-export-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvRows);
        }
    });
});

// Export sold items only
app.get('/api/export/sold', (req, res) => {
    db.all('SELECT * FROM items WHERE is_sold = 1 ORDER BY sold_date DESC', [], (err, rows) => {
        if (err) {
            console.error('Error exporting sold items:', err.message);
            res.status(500).json({ error: 'Failed to export sold items' });
        } else {
            const csvHeader = 'ID,Name,Color,Size,Brand,Bought Price,Sold For Price,Profit,Condition,Location,Season,Platform,Date Added,Sold Date,Description\n';
            const csvRows = rows.map(item => {
                const boughtPrice = parseFloat(item.bought_price) || 0;
                const sellingPrice = parseFloat(item.sold_for_price || item.price) || 0;
                const profit = sellingPrice - boughtPrice;

                return [
                    item.id,
                    `"${(item.name || '').replace(/"/g, '""')}"`,
                    `"${(item.color || '').replace(/"/g, '""')}"`,
                    `"${(item.size || '').replace(/"/g, '""')}"`,
                    `"${(item.brand || '').replace(/"/g, '""')}"`,
                    item.bought_price || '',
                    item.sold_for_price || item.price || '',
                    profit.toFixed(2),
                    `"${(item.condition_item || '').replace(/"/g, '""')}"`,
                    `"${(item.location || '').replace(/"/g, '""')}"`,
                    `"${(item.season || '').replace(/"/g, '""')}"`,
                    `"${(item.platform || 'Vinted').replace(/"/g, '""')}"`,
                    `"${item.date_added || ''}"`,
                    `"${item.sold_date || ''}"`,
                    `"${(item.description || '').replace(/"/g, '""')}"`
                ].join(',');
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="sold-items-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvRows);
        }
    });
});

// Export active items only
app.get('/api/export/active', (req, res) => {
    db.all('SELECT * FROM items WHERE (is_sold = 0 OR is_sold IS NULL) ORDER BY id DESC', [], (err, rows) => {
        if (err) {
            console.error('Error exporting active items:', err.message);
            res.status(500).json({ error: 'Failed to export active items' });
        } else {
            const csvHeader = 'ID,Name,Color,Size,Brand,Bought Price,Sold For Price,Expected Profit,Condition,Location,Season,Platform,Date Added,Description\n';
            const csvRows = rows.map(item => {
                const boughtPrice = parseFloat(item.bought_price) || 0;
                const sellingPrice = parseFloat(item.sold_for_price || item.price) || 0;
                const expectedProfit = sellingPrice - boughtPrice;

                return [
                    item.id,
                    `"${(item.name || '').replace(/"/g, '""')}"`,
                    `"${(item.color || '').replace(/"/g, '""')}"`,
                    `"${(item.size || '').replace(/"/g, '""')}"`,
                    `"${(item.brand || '').replace(/"/g, '""')}"`,
                    item.bought_price || '',
                    item.sold_for_price || item.price || '',
                    expectedProfit.toFixed(2),
                    `"${(item.condition_item || '').replace(/"/g, '""')}"`,
                    `"${(item.location || '').replace(/"/g, '""')}"`,
                    `"${(item.season || '').replace(/"/g, '""')}"`,
                    `"${(item.platform || 'Vinted').replace(/"/g, '""')}"`,
                    `"${item.date_added || ''}"`,
                    `"${(item.description || '').replace(/"/g, '""')}"`
                ].join(',');
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="active-items-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvRows);
        }
    });
});

// Export brand report
app.get('/api/export/brand-report', (req, res) => {
    const sql = `
        SELECT 
            COALESCE(brand, 'No Brand') as brand_name,
            COUNT(*) as total_items,
            SUM(CASE WHEN is_sold = 1 THEN 1 ELSE 0 END) as sold_items,
            SUM(CASE WHEN (is_sold = 0 OR is_sold IS NULL) THEN 1 ELSE 0 END) as available_items,
            AVG(COALESCE(sold_for_price, price, 0)) as avg_selling_price,
            AVG(COALESCE(bought_price, 0)) as avg_bought_price,
            SUM(CASE WHEN is_sold = 1 THEN COALESCE(sold_for_price, price, 0) - COALESCE(bought_price, 0) ELSE 0 END) as total_profit
        FROM items 
        GROUP BY COALESCE(brand, 'No Brand')
        ORDER BY total_items DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error generating brand report:', err.message);
            res.status(500).json({ error: 'Failed to generate brand report' });
        } else {
            const csvHeader = 'Brand,Total Items,Sold Items,Available Items,Avg Selling Price,Avg Bought Price,Total Profit\n';
            const csvRows = rows.map(row => {
                return [
                    `"${row.brand_name.replace(/"/g, '""')}"`,
                    row.total_items,
                    row.sold_items,
                    row.available_items,
                    row.avg_selling_price.toFixed(2),
                    row.avg_bought_price.toFixed(2),
                    row.total_profit.toFixed(2)
                ].join(',');
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="brand-report-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvRows);
        }
    });
});

// Export profit report
app.get('/api/export/profit-report', (req, res) => {
    const sql = `
        SELECT
            id, name, brand,
            COALESCE(bought_price, 0) as bought_price,
            COALESCE(sold_for_price, price, 0) as sold_for_price,
            COALESCE(sold_for_price, price, 0) - COALESCE(bought_price, 0) as profit,
            CASE
                WHEN COALESCE(bought_price, 0) > 0
                THEN ((COALESCE(sold_for_price, price, 0) - COALESCE(bought_price, 0)) / COALESCE(bought_price, 0)) * 100
                ELSE 0
            END as profit_margin_percent,
            is_sold, date_added, sold_date
        FROM items
        WHERE bought_price IS NOT NULL AND (sold_for_price IS NOT NULL OR price IS NOT NULL)
        ORDER BY profit DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error generating profit report:', err.message);
            res.status(500).json({ error: 'Failed to generate profit report' });
        } else {
            const csvHeader = 'ID,Name,Brand,Bought Price,Sold For Price,Profit,Profit Margin %,Status,Date Added,Sold Date\n';
            const csvRows = rows.map(row => {
                return [
                    row.id,
                    `"${(row.name || '').replace(/"/g, '""')}"`,
                    `"${(row.brand || '').replace(/"/g, '""')}"`,
                    row.bought_price.toFixed(2),
                    row.sold_for_price.toFixed(2),
                    row.profit.toFixed(2),
                    row.profit_margin_percent.toFixed(1),
                    row.is_sold ? 'SOLD' : 'AVAILABLE',
                    `"${row.date_added || ''}"`,
                    `"${row.sold_date || ''}"`
                ].join(',');
            }).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="profit-report-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvRows);
        }
    });
});

// Export labels as PDF
app.post('/api/export/labels-pdf', async (req, res) => {
    try {
        const { itemIds } = req.body;

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'No item IDs provided' });
        }

        // Fetch items from database
        const placeholders = itemIds.map(() => '?').join(',');
        const sql = `
            SELECT id, item_number, name, brand, color, size, collar_size,
                   condition_item, COALESCE(sold_for_price, price, 0) as price
            FROM items
            WHERE id IN (${placeholders})
            ORDER BY id DESC
        `;

        db.all(sql, itemIds, async (err, items) => {
            if (err) {
                console.error('Error fetching items:', err);
                return res.status(500).json({ error: 'Failed to fetch items' });
            }

            if (items.length === 0) {
                return res.status(404).json({ error: 'No items found' });
            }

            try {
                // Create PDF document - 40mm x 30mm
                const doc = new PDFDocument({
                    size: [113.39, 85.04], // 40mm x 30mm in points (1mm = 2.83465 points)
                    margins: { top: 5, bottom: 5, left: 5, right: 5 }
                });

                // Set response headers
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="labels-${new Date().toISOString().split('T')[0]}.pdf"`);

                // Pipe PDF to response
                doc.pipe(res);

                // Generate labels
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];

                    // Add new page for each label (except first)
                    if (i > 0) {
                        doc.addPage();
                    }

                    // Left column - text info
                    const leftColWidth = 55;
                    const qrSize = 48; // Larger QR code for better scanning
                    const qrX = leftColWidth + 5;

                    // Item ID - larger and bold
                    doc.fontSize(12)
                       .font('Helvetica-Bold')
                       .text(`#${String(item.id).padStart(3, '0')}`, 5, 5);

                    // Item name - compact with more space after ID
                    doc.fontSize(6)
                       .font('Helvetica-Bold')
                       .text(item.name, 5, 20, { width: leftColWidth - 5, lineGap: 0.5 });

                    let yPos = doc.y + 2;

                    // Item details - very compact
                    doc.fontSize(5)
                       .font('Helvetica')
                       .text(`${item.brand || 'N/A'}`, 5, yPos, { width: leftColWidth - 5 });

                    yPos = doc.y + 1;
                    doc.text(`Size: ${item.size}${item.collar_size ? ` (${item.collar_size})` : ''}`, 5, yPos, { width: leftColWidth - 5 });

                    yPos = doc.y + 1;
                    doc.text(`${item.color}`, 5, yPos, { width: leftColWidth - 5 });

                    // Generate QR code - larger for better scanning
                    const qrUrl = `${req.protocol}://${req.get('host')}/?item=${item.id}&popup=true`;
                    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
                        width: 200,
                        margin: 1,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });

                    // Convert data URL to buffer
                    const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

                    // Add QR code image on the right side - larger
                    doc.image(qrBuffer, qrX, 15, { width: qrSize, height: qrSize });
                }

                // Finalize PDF
                doc.end();

            } catch (pdfError) {
                console.error('Error generating PDF:', pdfError);
                res.status(500).json({ error: 'Failed to generate PDF' });
            }
        });

    } catch (error) {
        console.error('Error in PDF export:', error);
        res.status(500).json({ error: 'Failed to export labels' });
    }
});

// Export location report
app.get('/api/export/location-report', (req, res) => {
    const sql = `
        SELECT 
            COALESCE(location, 'No Location') as location_name,
            COUNT(*) as total_items,
            SUM(CASE WHEN is_sold = 1 THEN 1 ELSE 0 END) as sold_items,
            SUM(CASE WHEN (is_sold = 0 OR is_sold IS NULL) THEN 1 ELSE 0 END) as available_items,
            GROUP_CONCAT(DISTINCT brand) as brands_in_location
        FROM items 
        GROUP BY COALESCE(location, 'No Location')
        ORDER BY total_items DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error generating location report:', err.message);
            res.status(500).json({ error: 'Failed to generate location report' });
        } else {
            const csvHeader = 'Location,Total Items,Sold Items,Available Items,Brands in Location\n';
            const csvRows = rows.map(row => {
                return [
                    `"${row.location_name.replace(/"/g, '""')}"`,
                    row.total_items,
                    row.sold_items,
                    row.available_items,
                    `"${(row.brands_in_location || '').replace(/"/g, '""')}"`
                ].join(',');
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="location-report-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvRows);
        }
    });
});

// Database backup
app.get('/api/backup', (req, res) => {
    const backupPath = `./data/backup-${Date.now()}.db`;
    
    db.backup(backupPath, (err) => {
        if (err) {
            console.error('Error creating backup:', err.message);
            res.status(500).json({ error: 'Failed to create backup' });
        } else {
            res.download(backupPath, `inventory-backup-${new Date().toISOString().split('T')[0]}.db`, (err) => {
                if (err) {
                    console.error('Error downloading backup:', err.message);
                }
                // Clean up backup file
                fs.unlink(backupPath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('Error cleaning up backup file:', unlinkErr.message);
                    }
                });
            });
        }
    });
});

// ================================
// HEALTH CHECK ENDPOINT
// ================================

// Health check endpoint for Docker and monitoring
app.get('/health', (req, res) => {
    // Check database connectivity
    db.get('SELECT 1 as health_check', [], (err) => {
        if (err) {
            console.error('Health check failed - database unavailable:', err.message);
            return res.status(503).json({
                status: 'unhealthy',
                error: 'Database unavailable',
                timestamp: new Date().toISOString()
            });
        }

        res.status(200).json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });
});

// ================================
// SERVE STATIC FILES
// ================================

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'inventory.html'));
});

app.get('/manage', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'management.html'));
});

app.get('/insights', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'insights.html'));
});

app.get('/print-all-labels', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'print-all-labels.html'));
});

// QR Code generation
app.get('/qr/:id', async (req, res) => {
    const { id } = req.params;
    const url = `${req.protocol}://${req.get('host')}/?item=${id}&popup=true`;
    try {
        const png = await QRCode.toBuffer(url, { width: 200, margin: 1 });
        res.setHeader('Content-Type', 'image/png');
        res.send(png);
    } catch (err) {
        console.error('QR generation error:', err);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// ================================
// ERROR HANDLING
// ================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ================================
// SERVER STARTUP
// ================================

// Graceful shutdown handler for both SIGINT (Ctrl+C) and SIGTERM (Docker stop)
const gracefulShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Graceful shutdown...`);
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /health              - Health check endpoint');
    console.log('  GET  /                    - Main inventory page');
    console.log('  GET  /manage              - Management page');
    console.log('  GET  /insights            - Insights page');
    console.log('  GET  /api/items           - Get all items');
    console.log('  POST /api/items           - Create new item');
    console.log('  GET  /api/brands          - Get active brands');
    console.log('  GET  /api/brands/all      - Get all brands');
    console.log('  POST /api/brands          - Create new brand');
    console.log('  GET  /api/stats           - Get statistics');
    console.log('  GET  /api/export/csv      - Export CSV');
    console.log('  GET  /api/backup          - Download database backup');
});

module.exports = app;