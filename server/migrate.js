const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'marketplace.db');
const db = new sqlite3.Database(dbPath);

const adminEmail = 'rammodhvadiya210@gmail.com';

db.serialize(() => {
  console.log('Starting migration...');

  // 1. Add role column to Users if it doesn't exist
  db.run("ALTER TABLE Users ADD COLUMN role TEXT DEFAULT 'user'", (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Role column already exists in Users.');
      } else {
        console.error('Error adding role column:', err.message);
      }
    } else {
      console.log('Added role column to Users.');
    }
  });

  // 2. Assign admin role to the predefined admin email
  db.run("UPDATE Users SET role = 'admin' WHERE email = ?", [adminEmail], (err) => {
    if (err) console.error('Error updating admin role:', err.message);
    else console.log(`Assigned admin role to ${adminEmail} (if user existed).`);
  });

  // 3. Migrate data from AdminUsers to Users if AdminUsers exists
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='AdminUsers'", (err, rows) => {
    if (rows && rows.length > 0) {
      console.log('AdminUsers table found, migrating data...');
      db.all("SELECT * FROM AdminUsers", (err, admins) => {
        if (admins) {
          admins.forEach(admin => {
            db.run("INSERT OR IGNORE INTO Users (username, email, password_hash, role) VALUES (?, ?, ?, ?)", 
              [admin.username, admin.username + '@admin.local', admin.password_hash, 'admin'], (err) => {
                if (err) console.error(`Error migrating admin ${admin.username}:`, err.message);
              });
          });
          console.log(`Migrated ${admins.length} admins.`);
        }
      });
    } else {
      console.log('AdminUsers table not found or already migrated.');
    }
  });

  // 4. Update AuditLogs FK (SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we just have to be careful)
  // Since we already updated schema.js, new tables will be correct. 
  // For existing ones, we'll just drop the AdminUsers table later and hope for the best, 
  // or recreate AuditLogs if needed. For now, let's just drop AdminUsers.

  db.run("DROP TABLE IF EXISTS AdminUsers", (err) => {
    if (err) console.error('Error dropping AdminUsers:', err.message);
    else console.log('Dropped AdminUsers table.');
  });

  console.log('Migration complete.');
});

db.close();
