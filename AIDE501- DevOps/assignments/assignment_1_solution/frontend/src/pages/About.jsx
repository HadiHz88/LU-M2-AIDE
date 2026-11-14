import { useEffect, useState } from "react";
import { api } from "../api.js";

// Shows the live API health so you can prove, from the browser, that the
// frontend -> backend -> database chain works wherever the app is deployed.
export default function About() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api("/health").then(setHealth).catch(() => setHealth({ status: "unreachable" }));
  }, []);

  return (
    <article className="detail">
      <h1>About</h1>
      <p>
        Campus Events is a three-tier web application built for the AIDE501 DevOps course: a React
        frontend served by nginx, a Node.js/Express REST API, and a PostgreSQL database, each in its
        own container.
      </p>
      <pre className="diagram">{`Browser ──► nginx (frontend) ──/api──► Express (backend) ──► PostgreSQL (db)
            :80 public              :3000 internal               :5432 internal`}</pre>

      <h2>System status</h2>
      <p>
        API: <strong>{health?.status ?? "checking…"}</strong>
        {health?.db && <> · Database: <strong>{health.db}</strong></>}
      </p>

      <h2>REST API</h2>
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>Auth</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td>/api/health</td><td>–</td></tr>
          <tr><td>GET</td><td>/api/stats</td><td>–</td></tr>
          <tr><td>POST</td><td>/api/auth/register · /api/auth/login</td><td>–</td></tr>
          <tr><td>GET</td><td>/api/auth/me</td><td>Bearer</td></tr>
          <tr><td>GET</td><td>/api/events?q=&amp;category=</td><td>–</td></tr>
          <tr><td>GET</td><td>/api/events/:id</td><td>–</td></tr>
          <tr><td>POST</td><td>/api/events</td><td>Bearer</td></tr>
          <tr><td>DELETE</td><td>/api/events/:id</td><td>Bearer (organizer)</td></tr>
          <tr><td>GET · POST</td><td>/api/events/:id/rsvp</td><td>Bearer</td></tr>
        </tbody>
      </table>
    </article>
  );
}
