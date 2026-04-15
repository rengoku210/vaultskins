const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'marketplace.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE Listings ADD COLUMN image_url TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("Column image_url already exists.");
      } else {
        console.error("Error adding column:", err.message);
      }
    } else {
      console.log("Column image_url added successfully.");
    }
    db.close();
  });
});
