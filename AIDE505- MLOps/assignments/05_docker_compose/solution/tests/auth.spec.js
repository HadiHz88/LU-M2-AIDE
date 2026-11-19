import { test, expect } from "@playwright/test";

// The database keeps users between runs, so "alice" would already exist the
// second time. Each test registers a new, unique username instead.
const uniqueName = () => `user_${Math.random().toString(36).slice(2, 10)}`;

// Helper: fill the form on the current page and submit it.
async function submitForm(page, username, password, button) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: button }).click();
}

let username;

test.beforeEach(async ({ page }) => {
  username = uniqueName();
  await page.goto("/#/register");
  await submitForm(page, username, "secret123", "Register");
  await expect(page.getByRole("alert")).toHaveText(`Account created for ${username}. Please log in.`);
});

// Happy path
test("registered user can log in", async ({ page }) => {
  await submitForm(page, username, "secret123", "Log in");

  await expect(page).toHaveURL(/#\/welcome$/);
  await expect(page.getByRole("heading", { name: `Welcome, ${username}!` })).toBeVisible();
});

// Sad path
test("login with invalid credentials shows an error", async ({ page }) => {
  await submitForm(page, username, "wrong-pass1", "Log in");

  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
});

// Exercise 5: the welcome page shows the number of users stored in the database.
test("welcome page shows the user count", async ({ page }) => {
  await submitForm(page, username, "secret123", "Log in");

  await expect(page.locator("#user-count")).toHaveText(/^\d+ registered users? in the database\.$/);
});
