// Talks to the backend. Replaces the in-memory UserStore from auth.js.
// Paths start with /api: nginx forwards those requests to the backend container.

export class ApiError extends Error {}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError("Server unavailable, please try again"); // no network at all
  }
  // 5xx: backend crashed, or nginx can't reach it (502 Bad Gateway).
  if (res.status >= 500) throw new ApiError("Server unavailable, please try again");
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const post = (path, body) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// Returns the normalised username, or throws ApiError with the server's message.
export async function register(username, password) {
  const res = await post("/register", { username, password });
  if (!res.ok) throw new ApiError(res.data.error ?? "Registration failed");
  return res.data.username;
}

// Returns the username on success, null on wrong credentials.
export async function login(username, password) {
  const res = await post("/login", { username, password });
  if (res.ok) return res.data.username;
  if (res.status === 401) return null;
  throw new ApiError(res.data.error ?? "Login failed");
}

// Exercise 5: number of registered users.
export async function userCount() {
  const res = await request("/users/count");
  if (!res.ok) throw new ApiError("Could not load the user count");
  return res.data.count;
}
