// HTTP layer: a small JSON API. Business logic lives in auth.js.
import express from "express";
import { AuthError, countUsers, login, register } from "./auth.js";
import { initDb, pool } from "./db.js";

const app = express();
app.use(express.json()); // parse JSON request bodies into req.body

// Is the backend up, and can it reach the database?
app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
});

app.post("/api/register", async (req, res) => {
  const { username = "", password = "" } = req.body ?? {};
  try {
    const name = await register(username, password);
    console.log(`Registered user ${name}`);
    res.status(201).json({ username: name });
  } catch (err) {
    if (err instanceof AuthError) return res.status(400).json({ error: err.message });
    throw err; // unexpected: Express answers 500
  }
});

app.post("/api/login", async (req, res) => {
  const { username = "", password = "" } = req.body ?? {};
  const name = await login(username, password);
  if (!name) {
    console.log("Failed login attempt");
    return res.status(401).json({ error: "Invalid username or password" });
  }
  console.log(`User ${name} logged in`);
  res.json({ username: name });
});

// Exercise 5: number of registered users, shown on the welcome page.
app.get("/api/users/count", async (req, res) => {
  res.json({ count: await countUsers() });
});

// Any error not handled above ends up here: answer in JSON, never leak a stack trace.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT ?? 3000);

await initDb();
const server = app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));

// `docker compose down` sends SIGTERM: close cleanly instead of waiting to be killed.
process.on("SIGTERM", () => {
  server.close(() => pool.end().then(() => process.exit(0)));
});
