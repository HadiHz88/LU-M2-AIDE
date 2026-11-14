import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { formatDate } from "../format.js";

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [going, setGoing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/events/${id}`).then(setEvent).catch((e) => setError(e.message));
    if (user) api(`/events/${id}/rsvp`).then((d) => setGoing(d.going)).catch(() => {});
  }, [id, user]);

  useEffect(load, [load]);

  const toggleRsvp = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`/events/${id}/rsvp`, { method: "POST" });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this event?")) return;
    try {
      await api(`/events/${id}`, { method: "DELETE" });
      navigate("/events");
    } catch (e) {
      setError(e.message);
    }
  };

  if (!event) return error ? <p className="error">{error}</p> : <p className="empty">Loading…</p>;

  const seatsLeft = event.capacity - event.attendees;
  const pct = Math.min(100, Math.round((event.attendees / event.capacity) * 100));

  return (
    <article className="detail">
      <Link to="/events" className="muted">← All events</Link>
      <span className="tag">{event.category}</span>
      <h1>{event.title}</h1>
      <p className="muted">
        {formatDate(event.starts_at)} · 📍 {event.location}
        {event.organizer && <> · Organized by {event.organizer}</>}
      </p>
      <p>{event.description}</p>

      <div className="capacity" aria-label={`${pct}% full`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <p className="muted">
        {event.attendees} going · {seatsLeft > 0 ? `${seatsLeft} seats left` : "Full"}
      </p>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        {user ? (
          <button className="button" onClick={toggleRsvp} disabled={busy || (!going && seatsLeft <= 0)}>
            {going ? "Cancel my seat" : "Reserve a seat"}
          </button>
        ) : (
          <Link className="button" to="/login" state={{ from: `/events/${id}` }}>
            Sign in to reserve
          </Link>
        )}
        {user && user.id === event.created_by && (
          <button className="button danger" onClick={remove}>Delete event</button>
        )}
      </div>
    </article>
  );
}
