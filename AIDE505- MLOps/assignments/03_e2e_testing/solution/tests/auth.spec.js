import { test, expect } from "@playwright/test";

// Helper: fill the form on the current page and submit it.
async function submitForm(page, username, password, button) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: button }).click();
}

// Tests that need a registered user.
test.describe("with alice registered", () => {
  // Every test starts in a fresh browser tab, so the in-memory store is empty.
  // Each test therefore registers its own user first.
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/register");
    await submitForm(page, "alice", "secret123", "Register");
    await expect(page.getByRole("alert")).toHaveText("Account created for alice. Please log in.");
  });

  // Happy path (checklist row 5)
  test("registered user can log in", async ({ page }) => {
    await submitForm(page, "alice", "secret123", "Log in");

    await expect(page).toHaveURL(/#\/welcome$/);
    await expect(page.getByRole("heading", { name: "Welcome, alice!" })).toBeVisible();
  });

  // Sad path (checklist row 4)
  test("login with invalid credentials shows an error", async ({ page }) => {
    await submitForm(page, "alice", "wrong-pass1", "Log in");

    await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
  });

  // Exercise 2: a user who never registered gets the same error as a wrong password.
  test("login as an unknown user shows an error", async ({ page }) => {
    await submitForm(page, "bob", "secret123", "Log in");

    await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
  });

  // Exercise 4 (checklist row 6): after logging out, #/welcome sends you back to login.
  test("after logging out, the welcome page redirects to login", async ({ page }) => {
    await submitForm(page, "alice", "secret123", "Log in");
    await expect(page.getByRole("heading", { name: "Welcome, alice!" })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/#\/login$/);

    // Same tab, only the hash changes: no reload, so this tests the app's own guard.
    await page.goto("/#/welcome");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeHidden();
  });

  // Extra (checklist row 3): the same username cannot be registered twice.
  test("registering an existing username shows an error", async ({ page }) => {
    await page.getByRole("link", { name: "Create an account" }).click();
    // The form is re-rendered on "hashchange", a moment after the click. Wait for the
    // new page, or fill() may type into the old form just before it is replaced.
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await submitForm(page, "alice", "secret123", "Register");

    await expect(page.getByRole("alert")).toHaveText("Username already taken");
    await expect(page).toHaveURL(/#\/register$/);
  });

  // Extra (checklist row 7): users live only in memory, so a page refresh wipes them.
  test("refreshing the page forgets registered users", async ({ page }) => {
    await page.reload();
    await submitForm(page, "alice", "secret123", "Log in");

    await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
  });
});

// Exercise 3 (checklist row 1): validation runs before anything is stored.
test("registering with a too-short password shows an error", async ({ page }) => {
  await page.goto("/#/register");
  await submitForm(page, "alice", "abc", "Register");

  await expect(page.getByRole("alert")).toHaveText("Password must be at least 8 characters");
  await expect(page).toHaveURL(/#\/register$/);

  // Nothing was stored: alice cannot log in.
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible(); // wait for the re-render
  await submitForm(page, "alice", "abc", "Log in");
  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
});
