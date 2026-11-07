import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:5173", // lets tests call page.goto("/#/login")
    trace: "retain-on-failure",       // step-by-step recording when a test fails
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Playwright starts the app before the tests and stops it afterwards.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true, // if `npm run dev` is already running, use it
  },
});
