import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";

export const eventsRouter = Router();

export const CATEGORIES = ["Workshop", "Talk", "Study Group", "Hackathon", "Social"];

// Reject non-numeric ids early (404) instead of letting Postgres throw.
eventsRouter.param("id", (_req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(404).json({ error: "Event not found" });
  next();
});

// Shared SELECT: each event with its RSVP count.
const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.category, e.location, e.starts_at, e.capacity,
         e.created_by, u.name AS organizer,
         (SELECT count(*)::int FROM rsvps r WHERE r.event_id = e.id) AS attendees
  FROM events e
  LEFT JOIN users u ON u.id = e.created_by
`;

// GET /api/events?q=docker&category=Workshop
eventsRouter.get("/", async (req, res) => {
  const { q, category } = req.query;
  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    where.push(`e.category = $${params.length}`);
  }
  // Values always go through $n placeholders (parameterized query) -> no SQL injection.
  const sql = `${EVENT_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY e.starts_at`;
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

eventsRouter.get("/categories", (_req, res) => res.json(CATEGORIES));

eventsRouter.get("/:id", async (req, res) => {
  const { rows } = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Event not found" });
  res.json(rows[0]);
});

eventsRouter.post("/", requireAuth, async (req, res) => {
  const { title, description, category, location, starts_at, capacity } = req.body ?? {};
  const cap = Number(capacity);
  if (
    !title?.trim() ||
    !description?.trim() ||
    !location?.trim() ||
    !CATEGORIES.includes(category) ||
    Number.isNaN(Date.parse(starts_at)) ||
    !Number.isInteger(cap) ||
    cap < 1
  ) {
    return res.status(400).json({ error: "Invalid event: check every field" });
  }
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, category, location, starts_at, capacity, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [title.trim(), description.trim(), category, location.trim(), starts_at, cap, req.user.id],
  );
  res.status(201).json({ id: rows[0].id });
});

// Authorization = "what are you allowed to do?": only the organizer may delete.
eventsRouter.delete("/:id", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT created_by FROM events WHERE id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Event not found" });
  if (rows[0].created_by !== req.user.id) {
    return res.status(403).json({ error: "Only the organizer can delete this event" });
  }
  await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);
  res.status(204).end();
});

// Is the current user going?
eventsRouter.get("/:id/rsvp", requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM rsvps WHERE user_id = $1 AND event_id = $2",
    [req.user.id, req.params.id],
  );
  res.json({ going: rowCount > 0 });
});

// Toggle RSVP. Capacity is checked inside a transaction with a row lock so two
// people cannot take the last seat at the same time.
eventsRouter.post("/:id/rsvp", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ev = await client.query("SELECT capacity FROM events WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    if (!ev.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Event not found" });
    }
    const removed = await client.query("DELETE FROM rsvps WHERE user_id = $1 AND event_id = $2", [
      req.user.id,
      req.params.id,
    ]);
    let going = false;
    if (removed.rowCount === 0) {
      const { rows } = await client.query(
        "SELECT count(*)::int AS n FROM rsvps WHERE event_id = $1",
        [req.params.id],
      );
      if (rows[0].n >= ev.rows[0].capacity) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Event is full" });
      }
      await client.query("INSERT INTO rsvps (user_id, event_id) VALUES ($1, $2)", [
        req.user.id,
        req.params.id,
      ]);
      going = true;
    }
    await client.query("COMMIT");
    res.json({ going });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});
