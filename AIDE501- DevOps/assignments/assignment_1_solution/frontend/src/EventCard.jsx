import { Link } from "react-router-dom";
import { formatDate } from "./format.js";

export default function EventCard({ event }) {
  const full = event.attendees >= event.capacity;
  return (
    <Link to={`/events/${event.id}`} className="card">
      <span className="tag">{event.category}</span>
      <h3>{event.title}</h3>
      <p className="muted">{formatDate(event.starts_at)}</p>
      <p className="muted">📍 {event.location}</p>
      <p className={full ? "seats full" : "seats"}>
        {full ? "Full" : `${event.capacity - event.attendees} of ${event.capacity} seats left`}
      </p>
    </Link>
  );
}
