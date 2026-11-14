import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signIn(mode, form);
      navigate(location.state?.from ?? "/events", { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>{mode === "login" ? "Sign in" : "Create an account"}</h1>
      {mode === "register" && (
        <label>Name<input required value={form.name} onChange={set("name")} autoComplete="name" /></label>
      )}
      <label>
        Email
        <input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={set("password")}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button" type="submit">
        {mode === "login" ? "Sign in" : "Create account"}
      </button>
      <button
        type="button"
        className="link-button"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "No account? Register" : "Already registered? Sign in"}
      </button>
    </form>
  );
}
