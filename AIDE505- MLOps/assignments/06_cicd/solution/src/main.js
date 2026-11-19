// UI layer: renders the pages and reacts to the forms. Users are stored by the backend.
import "./style.css";
import * as api from "./api.js";

// UI state only. Users now live in the database, behind the backend API.
let currentUser = null; // username once logged in
let flash = null;       // one-time message: { type: "error" | "success", text }

const app = document.querySelector("#app");

const FORMS = {
  register: {
    title: "Create an account",
    button: "Register",
    autocomplete: "new-password",
    alt: 'Already have an account? <a href="#/login">Log in</a>',
  },
  login: {
    title: "Log in",
    button: "Log in",
    autocomplete: "current-password",
    alt: 'New here? <a href="#/register">Create an account</a>',
  },
};

// Navigation uses the URL hash (#/login, #/register, #/welcome).
// Changing the hash never reloads the page, so the variables above survive.
function go(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}

function showFlash() {
  if (!flash) return;
  const box = document.createElement("div");
  box.className = `flash ${flash.type}`;
  box.setAttribute("role", "alert");
  box.textContent = flash.text;
  app.prepend(box);
  flash = null; // shown once, like Flask's flash()
}

function renderForm(mode) {
  const f = FORMS[mode];
  app.innerHTML = `
    <h1>${f.title}</h1>
    <form>
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="${f.autocomplete}" required>
      <button type="submit">${f.button}</button>
    </form>
    <p class="alt">${f.alt}</p>`;
  app.querySelector("form").addEventListener("submit", (e) => onSubmit(e, mode));
}

function renderWelcome() {
  app.innerHTML = `
    <h1></h1>
    <p>You are logged in. Deployed automatically by CI/CD.</p>
    <p class="count" id="user-count">Counting users…</p>
    <button type="button">Log out</button>`;
  app.querySelector("h1").textContent = `Welcome, ${currentUser}!`;
  showUserCount(app.querySelector("#user-count"));
  app.querySelector("button").addEventListener("click", () => {
    currentUser = null;
    go("/login");
  });
}

// Exercise 5: ask the backend how many users are registered.
async function showUserCount(el) {
  try {
    const count = await api.userCount();
    el.textContent = `${count} registered user${count === 1 ? "" : "s"} in the database.`;
  } catch {
    el.textContent = "User count unavailable.";
  }
}

async function onSubmit(event, mode) {
  event.preventDefault();
  const form = event.target;
  const { username, password } = Object.fromEntries(new FormData(form));
  form.querySelector("button").disabled = true; // wait for the server

  try {
    if (mode === "register") {
      const name = await api.register(username, password);
      flash = { type: "success", text: `Account created for ${name}. Please log in.` };
      return go("/login");
    }
    const name = await api.login(username, password);
    if (name) {
      currentUser = name;
      return go("/welcome");
    }
    flash = { type: "error", text: "Invalid username or password" };
  } catch (err) {
    if (!(err instanceof api.ApiError)) throw err;
    flash = { type: "error", text: err.message };
  }
  render();
}

function render() {
  const route = location.hash.slice(1);
  if (route === "/register") renderForm("register");
  else if (route === "/welcome" && currentUser) renderWelcome();
  else if (route !== "/login") return go(currentUser ? "/welcome" : "/login");
  else renderForm("login");
  showFlash();
}

window.addEventListener("hashchange", render);
render();
