const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'marketplace.db');
const db = new sqlite3.Database(dbPath);

const run = (sql) => new Promise((resolve, reject) => {
    db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            reject(err);
        } else {
            resolve();
        }
    });
});

async function migrate() {
    try {
        console.log('Starting migration v3...');
        
        // 1. Add terms_accepted to Users
        await run("ALTER TABLE Users ADD COLUMN terms_accepted BOOLEAN DEFAULT 0");
        console.log('Added terms_accepted to Users');

        // 2. Add is_rentable and is_sellable to Listings
        await run("ALTER TABLE Listings ADD COLUMN is_rentable BOOLEAN DEFAULT 1");
        await run("ALTER TABLE Listings ADD COLUMN is_sellable BOOLEAN DEFAULT 1");
        console.log('Added is_rentable and is_sellable to Listings');

        console.log('Migration v3 completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        db.close();
    }
}

migrate();
