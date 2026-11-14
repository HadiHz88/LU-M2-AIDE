import express from "express";
import helmet from "helmet";
import { migrate, pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";

const app = express();
app.use(helmet()); // sensible security headers
app.use(express.json({ limit: "100kb" }));

// Liveness/readiness probe used by Docker healthchecks and by you with curl.
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

app.get("/api/stats", async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT (SELECT count(*)::int FROM events)                         AS events,
           (SELECT count(*)::int FROM events WHERE starts_at > now()) AS upcoming,
           (SELECT count(*)::int FROM users)                          AS users,
           (SELECT count(*)::int FROM rsvps)                          AS rsvps`);
  res.json(rows[0]);
});

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Express 5 forwards rejected promises from async handlers here.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" }); // never leak stack traces
});

const PORT = Number(process.env.PORT ?? 3000);

// Postgres may still be starting when the container boots; retry a few times.
for (let attempt = 1; ; attempt++) {
  try {
    await migrate();
    break;
  } catch (err) {
    if (attempt === 10) throw err;
    console.log(`Database not ready (${err.code ?? err.message}), retrying in 2s...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const server = app.listen(PORT, () => console.log(`API listening on :${PORT}`));

// `docker stop` sends SIGTERM: close connections cleanly instead of being killed after 10s.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
