import { useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Home from "./pages/Home.jsx";
import Events from "./pages/Events.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import NewEvent from "./pages/NewEvent.jsx";
import Login from "./pages/Login.jsx";
import About from "./pages/About.jsx";

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand" onClick={close}>
          📅 Campus Events
        </NavLink>
        <button
          className="menu-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          ☰
        </button>
        <nav className={menuOpen ? "nav open" : "nav"} onClick={close}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/events/new">Create</NavLink>
          <NavLink to="/about">About</NavLink>
          {user ? (
            <button className="link-button" onClick={signOut}>
              Sign out ({user.name})
            </button>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route
            path="/events/new"
            element={
              <RequireAuth>
                <NewEvent />
              </RequireAuth>
            }
          />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<p className="empty">Page not found.</p>} />
        </Routes>
      </main>

      <footer className="footer">AIDE501 DevOps · Assignment 1 reference solution</footer>
    </>
  );
}
