import { useEffect, useState } from "react";
import { api } from "../api.js";
import EventCard from "../EventCard.jsx";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/events/categories").then(setCategories).catch(() => {});
  }, []);

  // Re-query the API whenever the search box or the filter changes (debounced).
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const t = setTimeout(() => {
      api(`/events?${params}`).then(setEvents).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <>
      <h1>Events</h1>
      <div className="filters">
        <input
          type="search"
          placeholder="Search events…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search events"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && events.length === 0 && <p className="empty">No events match your search.</p>}

      <div className="grid">
        {events.map((e) => <EventCard key={e.id} event={e} />)}
      </div>
    </>
  );
}
