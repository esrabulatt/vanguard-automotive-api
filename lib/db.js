// Kalıcı veri: Node'un yerleşik SQLite'ı (ek paket gerekmez). Dosya: data/vanguard.db
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'vanguard.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id            TEXT PRIMARY KEY,
    car_id        TEXT,
    customer_name TEXT NOT NULL,
    phone         TEXT NOT NULL,
    type          TEXT NOT NULL,
    region        TEXT,
    address       TEXT,
    date          TEXT NOT NULL,
    time_slot     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    TEXT NOT NULL,
    -- WhatsApp bildirimi: not_configured | sent | failed
    notify_status TEXT,
    notify_error  TEXT,
    notified_at   TEXT
  )
`);

const toAppointment = (row) => ({
  id: row.id,
  carId: row.car_id,
  customerName: row.customer_name,
  phone: row.phone,
  type: row.type,
  ...(row.region ? { region: row.region } : {}),
  ...(row.address ? { address: row.address } : {}),
  date: row.date,
  timeSlot: row.time_slot,
  status: row.status,
  createdAt: row.created_at,
  notification: { status: row.notify_status, error: row.notify_error, at: row.notified_at },
});

const insertStmt = db.prepare(`
  INSERT INTO appointments (id, car_id, customer_name, phone, type, region, address, date, time_slot, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

module.exports = {
  insertAppointment(a) {
    insertStmt.run(a.id, a.carId, a.customerName, a.phone, a.type, a.region ?? null, a.address ?? null, a.date, a.timeSlot, a.status, a.createdAt);
  },
  listAppointments() {
    return db.prepare('SELECT * FROM appointments ORDER BY created_at DESC').all().map(toAppointment);
  },
  getAppointment(id) {
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    return row ? toAppointment(row) : null;
  },
  setNotification(id, status, error = null) {
    db.prepare('UPDATE appointments SET notify_status = ?, notify_error = ?, notified_at = ? WHERE id = ?').run(
      status,
      error,
      new Date().toISOString(),
      id,
    );
  },
};
