import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { pool } from "../db.js";
import { requireAuth, signToken } from "../auth.js";

export const authRouter = Router();

// Slow down brute-force attempts on the credential endpoints.
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post("/register", credentialLimiter, async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name?.trim() || !EMAIL_RE.test(email ?? "") || (password ?? "").length < 8) {
    return res
      .status(400)
      .json({ error: "Name, a valid email and a password of at least 8 characters are required" });
  }

  // Store a salted bcrypt hash, never the password itself.
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, lower($2), $3) RETURNING id, name, email",
      [name.trim(), email, hash],
    );
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    throw err;
  }
});

authRouter.post("/login", credentialLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  const { rows } = await pool.query(
    "SELECT id, name, email, password_hash FROM users WHERE email = lower($1)",
    [email ?? ""],
  );
  const user = rows[0];
  // Same message for "unknown email" and "wrong password" so attackers
  // cannot use the endpoint to discover which emails are registered.
  if (!user || !(await bcrypt.compare(password ?? "", user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const { password_hash, ...publicUser } = user;
  res.json({ token: signToken(publicUser), user: publicUser });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
