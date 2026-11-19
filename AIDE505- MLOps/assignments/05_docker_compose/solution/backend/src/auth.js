// Business logic: same rules as before, but users are now stored in PostgreSQL.
import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./db.js";

const pbkdf2Async = promisify(pbkdf2);
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

export class AuthError extends Error {}

// Returns "salt$hash" (both hex) using PBKDF2-SHA256.
async function hashPassword(password, salt = randomBytes(16)) {
  const hash = await pbkdf2Async(password, salt, 100_000, 32, "sha256");
  return `${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [saltHex] = stored.split("$");
  const candidate = await hashPassword(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
}

function validate(username, password) {
  if (!USERNAME_RE.test(username)) {
    throw new AuthError("Username must be 3-20 characters: letters, digits or underscore");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/\d/.test(password)) {
    throw new AuthError("Password must contain at least one digit");
  }
}

const normalize = (username) => String(username).trim().toLowerCase();

export async function register(rawUsername, password) {
  const username = normalize(rawUsername);
  validate(username, String(password));
  try {
    // $1, $2 are parameters: never build SQL by pasting user input into the string.
    await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [
      username,
      await hashPassword(String(password)),
    ]);
  } catch (err) {
    if (err.code === "23505") throw new AuthError("Username already taken"); // unique violation
    throw err;
  }
  return username;
}

// Returns the username on success, null on wrong credentials.
export async function login(rawUsername, password) {
  const username = normalize(rawUsername);
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE username = $1", [username]);
  if (rows.length === 0) return null;
  return (await verifyPassword(String(password), rows[0].password_hash)) ? username : null;
}

// Exercise 5: how many users are registered.
export async function countUsers() {
  // COUNT(*) is a bigint, which pg returns as a string to avoid precision loss.
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  return rows[0].count;
}
