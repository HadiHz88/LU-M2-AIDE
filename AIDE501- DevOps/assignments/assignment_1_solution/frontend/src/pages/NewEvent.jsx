import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function NewEvent() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Workshop",
    location: "",
    starts_at: "",
    capacity: 30,
  });

  useEffect(() => {
    api("/events/categories").then(setCategories).catch(() => {});
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = {
        ...form,
        capacity: Number(form.capacity),
        starts_at: new Date(form.starts_at).toISOString(), // local time -> UTC
      };
      const { id } = await api("/events", { method: "POST", body });
      navigate(`/events/${id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>Create an event</h1>
      <label>Title<input required value={form.title} onChange={set("title")} /></label>
      <label>
        Description
        <textarea required rows={4} value={form.description} onChange={set("description")} />
      </label>
      <div className="row">
        <label>
          Category
          <select value={form.category} onChange={set("category")}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Capacity
          <input type="number" min={1} required value={form.capacity} onChange={set("capacity")} />
        </label>
      </div>
      <label>Location<input required value={form.location} onChange={set("location")} /></label>
      <label>
        Starts at
        <input type="datetime-local" required value={form.starts_at} onChange={set("starts_at")} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button" type="submit">Publish event</button>
    </form>
  );
}
