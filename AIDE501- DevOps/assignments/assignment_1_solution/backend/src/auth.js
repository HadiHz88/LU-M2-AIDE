import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  // Fail fast: never fall back to a hard-coded secret baked into the image.
  console.error("JWT_SECRET must be set and at least 32 characters long");
  process.exit(1);
}

export function signToken(user) {
  // Short-lived bearer token. The payload is signed, NOT encrypted:
  // anyone can base64-decode it, so never put secrets in it.
  return jwt.sign({ sub: String(user.id), name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: "2h",
  });
}

// Express middleware: requires "Authorization: Bearer <token>".
// Authentication = "who are you?" (verify the token).
export function requireAuth(req, res, next) {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: Number(payload.sub), name: payload.name, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
