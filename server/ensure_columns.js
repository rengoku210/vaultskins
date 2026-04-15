const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'marketplace.db');
const db = new sqlite3.Database(dbPath);

const run = (sql) => new Promise((resolve, reject) => {
    db.run(sql, (err) => {
        if (err && (err.message.includes('duplicate column name') || err.message.includes('already exists'))) {
            resolve(); // Column already exists, safe to ignore
        } else if (err) {
            reject(err);
        } else {
            resolve();
        }
    });
});

async function migrate() {
    try {
        console.log('Ensuring all database columns exist...');
        
        // Users Table Extensions
        await run("ALTER TABLE Users ADD COLUMN terms_accepted BOOLEAN DEFAULT 0");
        console.log('- User: terms_accepted');
        
        // Listings Table Extensions
        await run("ALTER TABLE Listings ADD COLUMN image_url TEXT");
        console.log('- Listings: image_url');
        
        await run("ALTER TABLE Listings ADD COLUMN is_rentable BOOLEAN DEFAULT 1");
        console.log('- Listings: is_rentable');
        
        await run("ALTER TABLE Listings ADD COLUMN is_sellable BOOLEAN DEFAULT 1");
        console.log('- Listings: is_sellable');

        console.log('Database verification/migration complete.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        db.close();
    }
}

migrate();
