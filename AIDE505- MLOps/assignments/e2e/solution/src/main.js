// UI layer: renders the pages and reacts to the forms. Business logic lives in auth.js.
import "./style.css";
import { AuthError, UserStore } from "./auth.js";

// App state: plain variables, no database, no backend.
const users = new UserStore();
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
    <p>You are logged in.</p>
    <button type="button">Log out</button>`;
  app.querySelector("h1").textContent = `Welcome, ${currentUser}!`;
  app.querySelector("button").addEventListener("click", () => {
    currentUser = null;
    go("/login");
  });
}

async function onSubmit(event, mode) {
  event.preventDefault();
  const form = event.target;
  const { username, password } = Object.fromEntries(new FormData(form));
  form.querySelector("button").disabled = true; // hashing takes a moment

  if (mode === "register") {
    try {
      const name = await users.register(username, password);
      flash = { type: "success", text: `Account created for ${name}. Please log in.` };
      go("/login");
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      flash = { type: "error", text: err.message };
      render();
    }
    return;
  }

  if (await users.login(username, password)) {
    currentUser = UserStore.normalize(username);
    go("/welcome");
  } else {
    flash = { type: "error", text: "Invalid username or password" };
    render();
  }
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
