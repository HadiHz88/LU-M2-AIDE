import pg from "pg";

// One connection pool for the whole process. DATABASE_URL looks like
// postgres://user:password@host:5432/dbname
// - locally:        host = localhost (Postgres published by `docker compose up db`)
// - inside compose: host = db        (the service name, resolved by Docker's DNS)
export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/campus_events",
});

// Create tables on startup so the app works on a fresh database without a
// separate migration step. IF NOT EXISTS makes this safe to run every time.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  location    TEXT        NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  capacity    INTEGER     NOT NULL CHECK (capacity > 0),
  created_by  INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rsvps (
  user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
`;

const SEED_EVENTS = [
  ["Intro to Docker Workshop", "Hands-on session: images, containers, volumes and networks. Bring your laptop with Docker Desktop installed.", "Workshop", "Lab 3, Faculty of Sciences", 7, 30],
  ["AWS Cloud Practitioner Study Group", "Weekly study group covering IAM, EC2, S3 and billing. Free tier tips included.", "Study Group", "Library, Room 204", 10, 20],
  ["AI & Data Engineering Career Talk", "Alumni share how they moved from university projects to industry roles.", "Talk", "Main Amphitheater", 14, 150],
  ["Hackathon: Build a Containerized App", "24-hour hackathon. Teams of 3 ship a three-tier app with Docker Compose.", "Hackathon", "Innovation Hub", 21, 60],
  ["Linux Command Line Basics", "Navigate the shell, manage files and permissions, and write your first script.", "Workshop", "Lab 1, Faculty of Sciences", 28, 25],
];

export async function migrate() {
  await pool.query(SCHEMA);

  const { rows } = await pool.query("SELECT count(*)::int AS n FROM events");
  if (rows[0].n > 0) return;

  // Seed a few events (dates relative to today) so the UI is not empty on first run.
  for (const [title, description, category, location, inDays, capacity] of SEED_EVENTS) {
    await pool.query(
      `INSERT INTO events (title, description, category, location, starts_at, capacity)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval, $6)`,
      [title, description, category, location, inDays, capacity],
    );
  }
  console.log(`Seeded ${SEED_EVENTS.length} events`);
}
