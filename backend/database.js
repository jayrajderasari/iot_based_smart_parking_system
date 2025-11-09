const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

function createTables() {
  db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'consumer',
      created_at TEXT
    )`);

    // Slots Table
    db.run(`CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'free',
      category TEXT DEFAULT 'General',
      is_under_maintenance BOOLEAN DEFAULT 0,
      last_sensor_update TEXT
    )`);

    // Bookings Table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      slot_id TEXT,
      start_time TEXT,
      end_time TEXT,
      entry_time TEXT,
      exit_time TEXT,
      status TEXT, -- active, entered, completed, cancelled
      vehicle_number TEXT,
      phone_number TEXT,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (slot_id) REFERENCES slots (id)
    )`);

    // Payments Table
    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      user_id TEXT,
      amount REAL,
      status TEXT, -- pending, paid, failed
      created_at TEXT,
      FOREIGN KEY (booking_id) REFERENCES bookings (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // System Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT, -- INFO, WARN, ERROR
      event TEXT,
      details TEXT,
      timestamp TEXT
    )`);

    // Seed initial data
    seedData();
  });
}

function seedData() {
  const users = [
    { id: 'user-1', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'user-2', username: 'user1', password: 'user123', role: 'consumer' }
  ];

  const slots = [
    { id: 'S1', status: 'free' },
    { id: 'S2', status: 'free' },
    { id: 'S3', status: 'free' }
  ];

  const userInsert = db.prepare("INSERT OR IGNORE INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)");
  users.forEach(user => {
    userInsert.run(user.id, user.username, user.password, user.role, new Date().toISOString());
  });
  userInsert.finalize();

  const slotInsert = db.prepare("INSERT OR IGNORE INTO slots (id, status, last_sensor_update) VALUES (?, ?, ?)");
  slots.forEach(slot => {
    slotInsert.run(slot.id, slot.status, new Date().toISOString());
  });
  slotInsert.finalize((err) => {
    if (!err) {
        console.log('Database tables created and seeded successfully.');
    }
  });
}

module.exports = db;
