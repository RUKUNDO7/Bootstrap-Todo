import { useEffect, useMemo, useRef, useState } from "react";

const FILTERS = ["All", "Active", "Done"];
const TOKEN_KEY = "todo_app_token";
const USER_KEY = "todo_app_user";
const THEME_KEY = "todo_theme";

function loadSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  if (!token || !userRaw) return null;

  try {
    const user = JSON.parse(userRaw);
    return { token, user };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function persistSession(session) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

function clearSessionStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function parseResponseError(res, fallbackMessage) {
  try {
    const body = await res.json();
    if (body?.message) return body.message;
  } catch {
    // ignore parse errors and fallback to status text
  }
  return fallbackMessage;
}

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(await parseResponseError(res, "Request failed."));
  }

  if (res.status === 204) return null;
  return res.json();
}

const api = {
  signup(payload) {
    return apiRequest("/auth/signup", { method: "POST", body: payload });
  },
  login(payload) {
    return apiRequest("/auth/login", { method: "POST", body: payload });
  },
  me(token) {
    return apiRequest("/auth/me", { token });
  },
  list(token) {
    return apiRequest("/todos", { token });
  },
  create(token, title) {
    return apiRequest("/todos", { method: "POST", body: { title }, token });
  },
  toggle(token, id) {
    return apiRequest(`/todos/${id}/status`, { method: "PATCH", token });
  },
  remove(token, id) {
    return apiRequest(`/todos/${id}`, { method: "DELETE", token });
  },
  clearDone(token) {
    return apiRequest("/todos/status/true", { method: "DELETE", token });
  },
  update(token, id, payload) {
    return apiRequest(`/todos/${id}`, { method: "PUT", body: payload, token });
  }
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [session, setSession] = useState(() => loadSession());
  const [authMode, setAuthMode] = useState("signup");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });

  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingEditId, setSavingEditId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastCounter = useRef(0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const counts = useMemo(() => {
    const done = items.filter((item) => item.status).length;
    const active = items.length - done;
    return { total: items.length, done, active };
  }, [items]);

  const progressPercent = useMemo(() => {
    if (counts.total === 0) return 0;
    return Math.round((counts.done / counts.total) * 100);
  }, [counts.done, counts.total]);

  const visibleItems = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    let filtered = items;
    if (activeFilter === "Active") filtered = filtered.filter((item) => !item.status);
    if (activeFilter === "Done") filtered = filtered.filter((item) => item.status);
    if (term) filtered = filtered.filter((item) => item.title.toLowerCase().includes(term));
    return filtered;
  }, [items, activeFilter, searchText]);

  const pushToast = (variant, message) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, variant, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  };

  const forceLogout = (message) => {
    clearSessionStorage();
    setSession(null);
    setItems([]);
    setError("");
    setAuthError(message);
  };

  const loadTodos = async (token) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.list(token);
      setItems(data);
    } catch (err) {
      if (err.message.toLowerCase().includes("session")) {
        forceLogout(err.message);
      } else {
        setError("Failed to load todos.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.token) return;
    loadTodos(session.token);
  }, [session?.token]);

  useEffect(() => {
    const verifyStoredSession = async () => {
      if (!session?.token) return;
      try {
        const me = await api.me(session.token);
        const updated = { token: session.token, user: me };
        setSession(updated);
        persistSession(updated);
      } catch {
        forceLogout("Your session is no longer valid.");
      }
    };

    verifyStoredSession();
  }, []);

  const onAuthSubmit = async (event) => {
    event.preventDefault();
    if (authLoading) return;

    const username = authForm.username.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    if (!username || !password || (authMode === "signup" && !email)) {
      setAuthError("All required fields must be filled.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const payload = authMode === "signup" ? { username, email, password } : { username, password };
      const result = authMode === "signup" ? await api.signup(payload) : await api.login(payload);
      const nextSession = { token: result.token, user: result.user };
      setSession(nextSession);
      persistSession(nextSession);
      setAuthForm({ username: "", email: "", password: "" });
      pushToast("success", authMode === "signup" ? "Account created." : "Welcome back.");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const onLogout = () => {
    clearSessionStorage();
    setSession(null);
    setItems([]);
    setAuthMode("signup");
    setAuthError("");
  };

  const onAdd = async (event) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || submitting || !session?.token) return;

    setSubmitting(true);
    setError("");
    const tempId = -Date.now();
    setItems((prev) => [...prev, { id: tempId, title, status: false }]);
    setNewTitle("");

    try {
      const created = await api.create(session.token, title);
      setItems((prev) => prev.map((item) => (item.id === tempId ? created : item)));
      pushToast("success", "Task added.");
    } catch (err) {
      setItems((prev) => prev.filter((item) => item.id !== tempId));
      setNewTitle(title);
      if (err.message.toLowerCase().includes("session")) {
        forceLogout(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onToggle = async (id) => {
    if (!session?.token) return;
    setError("");
    const previous = items;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: !item.status } : item))
    );

    try {
      await api.toggle(session.token, id);
      pushToast("success", "Status updated.");
    } catch (err) {
      setItems(previous);
      if (err.message.toLowerCase().includes("session")) {
        forceLogout(err.message);
      } else {
        setError(err.message);
      }
    }
  };

  const onDelete = async (id) => {
    if (!session?.token) return;
    setError("");
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      await api.remove(session.token, id);
      pushToast("success", "Task deleted.");
    } catch (err) {
      setItems(previous);
      if (err.message.toLowerCase().includes("session")) {
        forceLogout(err.message);
      } else {
        setError(err.message);
      }
    }
  };

  const onClearDone = async () => {
    if (counts.done === 0 || !session?.token) return;
    setError("");
    const previous = items;
    setItems((prev) => prev.filter((item) => !item.status));

    try {
      await api.clearDone(session.token);
      pushToast("success", "Done tasks cleared.");
    } catch (err) {
      setItems(previous);
      if (err.message.toLowerCase().includes("session")) {
        forceLogout(err.message);
      } else {
        setError(err.message);
      }
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveEdit = async (item) => {
    if (!session?.token) return;

    const title = editTitle.trim();
    if (!title) {
      setError("Title cannot be empty.");
      return;
    }

    setError("");
    setSavingEditId(item.id);
    const previous = items;
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, title } : entry)));
    setEditingId(null);
    setEditTitle("");

    try {
      await api.update(session.token, item.id, { title, status: item.status });
      pushToast("success", "Task updated.");
    } catch (err) {
      setItems(previous);
      if (err.message.toLowerCase().includes("session")) {
        forceLogout(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setSavingEditId(null);
    }
  };

  if (!session) {
    return (
      <main className="app-shell mode-corporate">
        <section className="todo-panel auth-panel">
          <header className="panel-top">
            <p className="eyebrow">Task Board</p>
            <h1 className="title">{authMode === "signup" ? "Create your account" : "Welcome back"}</h1>
            <p className="subtitle">Sign in to get your own private dashboard.</p>
            <div className="auth-suggestion">
              {authMode === "signup"
                ? "Suggestion: If you already have an account, switch to Log in."
                : "Suggestion: If this is your first time, create an account using Sign up."}
            </div>
          </header>

          <form className="composer" onSubmit={onAuthSubmit}>
            <div className="input-wrap">
              <input
                className="task-input"
                type="text"
                placeholder="Username"
                value={authForm.username}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))}
                maxLength={30}
                autoComplete="username"
              />
            </div>
            {authMode === "signup" ? (
              <div className="input-wrap">
                <input
                  className="task-input"
                  type="email"
                  placeholder="Email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                  maxLength={120}
                  autoComplete="email"
                />
              </div>
            ) : null}
            <div className="input-wrap">
              <input
                className="task-input"
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                maxLength={120}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            <div className="toolbar auth-toolbar">
              <button className="add-btn" type="submit" disabled={authLoading}>
                {authLoading ? "Please wait..." : authMode === "signup" ? "Sign up" : "Log in"}
              </button>
            </div>
            <p className="auth-switch">
              {authMode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                className="auth-link"
                type="button"
                onClick={() => {
                  setAuthMode((prev) => (prev === "signup" ? "login" : "signup"));
                  setAuthError("");
                }}
              >
                {authMode === "signup" ? "Log in" : "Sign up"}
              </button>
            </p>
            {authError ? <div className="alert-inline">{authError}</div> : null}
          </form>
        </section>
        <button
          className="theme-fab"
          type="button"
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        >
          {theme === "light" ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V4.5a.75.75 0 0 1 .75-.75ZM12 17.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V18a.75.75 0 0 1 .75-.75ZM4.5 11.25a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1 0-1.5h1.5ZM21 11.25a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5H21ZM6.47 6.47a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L6.47 7.53a.75.75 0 0 1 0-1.06ZM17.47 17.47a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM18.53 6.47a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM7.53 17.47a.75.75 0 1 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06ZM12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13.24 2.25a.75.75 0 0 1 .64 1.13 8.25 8.25 0 1 0 6.74 10.8.75.75 0 0 1 1.4.53A9.75 9.75 0 1 1 12.71 2.9a.75.75 0 0 1 .53-.65Z" />
            </svg>
          )}
        </button>
      </main>
    );
  }

  return (
    <main className="app-shell mode-corporate">
      <nav className="top-nav">
        <div className="nav-left">
          <div className="brand-wrap">
            <span className="brand-dot" />
            <span className="brand-text">Task Desk</span>
          </div>
        </div>
        <div className="nav-meta">
          <span>{session.user.username}'s dashboard</span>
          <span>{counts.total} tasks</span>
          <button className="clear-btn" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </nav>

      <section className="todo-panel">
        <header className="panel-top">
          <p className="eyebrow">Task Board</p>
          <h1 className="title">Personal Workspace</h1>
          <p className="subtitle">Only your tasks are shown here.</p>
          <div className="summary-grid">
            <article className="summary-box">
              <p className="summary-label">Total</p>
              <p className="summary-value">{counts.total}</p>
            </article>
            <article className="summary-box">
              <p className="summary-label">Active</p>
              <p className="summary-value">{counts.active}</p>
            </article>
            <article className="summary-box">
              <p className="summary-label">Done</p>
              <p className="summary-value">{counts.done}</p>
            </article>
            <article className="summary-box">
              <p className="summary-label">Progress</p>
              <p className="summary-value">{progressPercent}%</p>
            </article>
          </div>
        </header>

        <div className="toolbar">
          <div className="filters" role="tablist" aria-label="Todo filters">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={`filter-btn ${activeFilter === filter ? "active" : ""}`}
                type="button"
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <button
            className="clear-btn"
            type="button"
            disabled={counts.done === 0}
            onClick={onClearDone}
          >
            Clear Done
          </button>
        </div>

        <form className="composer" onSubmit={onAdd}>
          <div className="search-wrap">
            <input
              className="search-input"
              type="search"
              placeholder="Search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <div className="input-wrap">
            <input
              className="task-input"
              type="text"
              placeholder="Add a task title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              maxLength={120}
            />
            <button className="add-btn" type="submit" disabled={submitting}>
              {submitting ? "Saving" : "Add"}
            </button>
          </div>
          {error ? <div className="alert-inline">{error}</div> : null}
        </form>

        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : visibleItems.length === 0 ? (
          <div className="empty">No tasks in this view.</div>
        ) : (
          <ul className="items">
            {visibleItems.map((item) => (
              <li className="item" key={item.id}>
                <button
                  className={`status-btn ${item.status ? "done" : ""}`}
                  type="button"
                  onClick={() => onToggle(item.id)}
                  disabled={savingEditId === item.id}
                  aria-label={item.status ? "Mark as active" : "Mark as done"}
                >
                  {item.status ? "OK" : "Do"}
                </button>

                {editingId === item.id ? (
                  <div className="edit-wrap">
                    <input
                      className="edit-input"
                      type="text"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveEdit(item);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelEdit();
                        }
                      }}
                      maxLength={120}
                      autoFocus
                    />
                    <button className="mini-btn save" type="button" onClick={() => saveEdit(item)}>
                      Save
                    </button>
                    <button className="mini-btn cancel" type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <p className={`task-title ${item.status ? "done" : ""}`}>{item.title}</p>
                    <div className="row-actions">
                      <button className="mini-btn edit" type="button" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button className="delete-btn" type="button" onClick={() => onDelete(item.id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.variant}`}>
            {toast.message}
          </div>
        ))}
      </aside>
      <button
        className="theme-fab"
        type="button"
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      >
        {theme === "light" ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V4.5a.75.75 0 0 1 .75-.75ZM12 17.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V18a.75.75 0 0 1 .75-.75ZM4.5 11.25a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1 0-1.5h1.5ZM21 11.25a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5H21ZM6.47 6.47a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L6.47 7.53a.75.75 0 0 1 0-1.06ZM17.47 17.47a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM18.53 6.47a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM7.53 17.47a.75.75 0 1 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06ZM12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13.24 2.25a.75.75 0 0 1 .64 1.13 8.25 8.25 0 1 0 6.74 10.8.75.75 0 0 1 1.4.53A9.75 9.75 0 1 1 12.71 2.9a.75.75 0 0 1 .53-.65Z" />
          </svg>
        )}
      </button>
    </main>
  );
}
