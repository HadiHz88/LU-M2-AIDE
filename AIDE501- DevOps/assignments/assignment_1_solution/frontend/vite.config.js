import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the browser talks to Vite (http://localhost:5173) and Vite
// forwards /api/* to the Express backend. In Docker, nginx plays the same role.
// Either way the browser only ever sees ONE origin, so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.API_URL ?? "http://localhost:3000",
    },
  },
});
