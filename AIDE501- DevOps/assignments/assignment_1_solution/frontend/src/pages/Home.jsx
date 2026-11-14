import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import EventCard from "../EventCard.jsx";

export default function Home() {
  const [stats, setStats] = useState(null);
  const [next, setNext] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/stats"), api("/events")])
      .then(([s, events]) => {
        setStats(s);
        setNext(events.filter((e) => new Date(e.starts_at) > new Date()).slice(0, 3));
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <section className="hero">
        <h1>What's happening on campus?</h1>
        <p>Find workshops, talks and study groups. Reserve your seat in one click.</p>
        <Link to="/events" className="button">Browse events</Link>
      </section>

      {error && <p className="error">Could not reach the API: {error}</p>}

      {stats && (
        <section className="stats">
          <div><strong>{stats.upcoming}</strong><span>upcoming events</span></div>
          <div><strong>{stats.rsvps}</strong><span>seats reserved</span></div>
          <div><strong>{stats.users}</strong><span>members</span></div>
        </section>
      )}

      <h2>Coming up next</h2>
      <div className="grid">
        {next.map((e) => <EventCard key={e.id} event={e} />)}
      </div>
    </>
  );
}
