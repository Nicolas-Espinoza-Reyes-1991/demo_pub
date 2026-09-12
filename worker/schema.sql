CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE menu_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- '' | 'comida' | 'trago': marks an item to show in the landing page's
  -- "Comida & tragos" preview. Capped at 3 per group by the API, enforced
  -- with a COUNT check rather than a DB constraint (SQLite can't easily
  -- express "at most 3 rows with this value").
  featured_group TEXT NOT NULL DEFAULT ''
);

CREATE TABLE popup_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  badge TEXT NOT NULL DEFAULT 'Esta semana',
  eyebrow TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  facts TEXT NOT NULL DEFAULT '[]',
  cta_primary_label TEXT NOT NULL DEFAULT 'Reservar mesa',
  cta_primary_href TEXT NOT NULL DEFAULT '#contacto',
  cta_secondary_label TEXT NOT NULL DEFAULT 'Ver agenda',
  cta_secondary_href TEXT NOT NULL DEFAULT '#eventos',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lets the admin edit the "Atención presencial" hours shown on the landing
-- page without a deploy — the venue runs a different schedule in
-- winter/summer. verano_start/verano_end are "MM-DD" (no year, since the
-- range repeats every year and can wrap across Dec 31 -> Jan 1); whichever
-- schedule doesn't match "today" (America/Santiago) is winter by default.
CREATE TABLE business_hours (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  verano_start TEXT NOT NULL DEFAULT '10-01',
  verano_end TEXT NOT NULL DEFAULT '03-31',
  verano_schedule TEXT NOT NULL DEFAULT '[]', -- JSON array of display lines
  invierno_schedule TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reservation system: a reservation holds a table for the whole night (bars
-- don't turn tables over by time slot the way lunch/dinner restaurants do),
-- so availability is keyed on (table, date) rather than (table, date, time).
CREATE TABLE venue_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER REFERENCES venue_tables(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  reservation_date TEXT NOT NULL, -- YYYY-MM-DD
  arrival_time TEXT NOT NULL DEFAULT '', -- HH:MM, informational only
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | confirmada | no_show | cancelada
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A table can only be double-booked if this index allows it: a second insert
-- for the same table+date while one is still pendiente/confirmada fails at
-- the database level, which is what actually prevents a race between two
-- people reserving the last table at the same moment (the app-level
-- availability check alone can't guarantee that).
CREATE UNIQUE INDEX idx_reservations_table_date_active
  ON reservations(table_id, reservation_date)
  WHERE status IN ('pendiente', 'confirmada');

-- Lets the admin close a whole date (private event, venue rented out) without
-- having to deactivate every table one by one.
CREATE TABLE blocked_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blocked_date TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
