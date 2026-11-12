// Database connection. The address comes from an environment variable,
// so the same code works locally and inside Docker Compose.
import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// If the database restarts, idle connections break. Log it instead of crashing:
// the pool opens fresh connections on the next query.
pool.on("error", (err) => console.error("Database connection lost:", err.message));

// Create the table on startup if it doesn't exist yet.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      username      TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
