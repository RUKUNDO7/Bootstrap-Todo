import { useEffect, useMemo, useState } from "react";

const FILTERS = ["All", "Active", "Done"];

function normalizeDueAtInput(value) {
  return value ? `${value}:00` : null;
}

function formatForDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDueAtDisplay(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

async function parseResponseError(res, fallbackMessage) {
  try {
    const body = await res.json();
    if (body?.message) return body.message;
  } catch {
    // ignore and fall back
  }
  return fallbackMessage;
}

async function apiRequest(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    throw new Error(await parseResponseError(res, "Request failed."));
  }

  if (res.status === 204) return null;
  return res.json();
}

const api = {
  list() {
    return apiRequest("/todos");
  },
  create(title, dueAt) {
    return apiRequest("/todos", { method: "POST", body: { title, dueAt } });
  },
  toggle(id) {
    return apiRequest(`/todos/${id}/status`, { method: "PATCH" });
  },
  remove(id) {
    return apiRequest(`/todos/${id}`, { method: "DELETE" });
  },
  clearDone() {
    return apiRequest("/todos/status/true", { method: "DELETE" });
  },
  update(id, payload) {
    return apiRequest(`/todos/${id}`, { method: "PUT", body: payload });
  }
};

export default function App() {
  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");

  useEffect(() => {
    const loadTodos = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.list();
        setItems(data);
      } catch {
        setError("Failed to load todos.");
      } finally {
        setLoading(false);
      }
    };

    loadTodos();
  }, []);

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

  const onAdd = async (event) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || submitting) return;
    const dueAt = normalizeDueAtInput(newDueAt);

    setSubmitting(true);
    setError("");
    const tempId = -Date.now();
    setItems((prev) => [...prev, { id: tempId, title, status: false, dueAt }]);
    setNewTitle("");
    setNewDueAt("");

    try {
      const created = await api.create(title, dueAt);
      setItems((prev) => prev.map((item) => (item.id === tempId ? created : item)));
    } catch (err) {
      setItems((prev) => prev.filter((item) => item.id !== tempId));
      setNewTitle(title);
      setNewDueAt(newDueAt);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onToggle = async (id) => {
    setError("");
    const previous = items;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: !item.status } : item)));

    try {
      await api.toggle(id);
    } catch (err) {
      setItems(previous);
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    setError("");
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      await api.remove(id);
    } catch (err) {
      setItems(previous);
      setError(err.message);
    }
  };

  const onClearDone = async () => {
    if (counts.done === 0) return;

    setError("");
    const previous = items;
    setItems((prev) => prev.filter((item) => !item.status));

    try {
      await api.clearDone();
    } catch (err) {
      setItems(previous);
      setError(err.message);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDueAt(formatForDateTimeInput(item.dueAt));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDueAt("");
  };

  const saveEdit = async (item) => {
    const title = editTitle.trim();
    if (!title) {
      setError("Title cannot be empty.");
      return;
    }
    const dueAt = normalizeDueAtInput(editDueAt);

    setError("");
    const previous = items;
    setItems((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, title, dueAt } : entry))
    );
    setEditingId(null);
    setEditTitle("");
    setEditDueAt("");

    try {
      await api.update(item.id, { title, status: item.status, dueAt });
    } catch (err) {
      setItems(previous);
      setError(err.message);
    }
  };

  return (
    <main className="app-shell mode-corporate">
      <section className="todo-panel">
        <header className="panel-top">
          <p className="eyebrow">Todo App</p>
          <h1 className="title">Simple Task List</h1>
          <p className="subtitle">Stay on top of your day.</p>
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
              <div className="progress-wrap">
                <p className="summary-value progress-value">{progressPercent}</p>
                <span
                  className="progress-ring"
                  style={{ "--p": `${progressPercent}%` }}
                  aria-label={`Progress ${progressPercent}%`}
                />
              </div>
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
          <button className="clear-btn" type="button" disabled={counts.done === 0} onClick={onClearDone}>
            Clear Done
          </button>
        </div>

        <form className="composer" onSubmit={onAdd}>
          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.5 3a7.5 7.5 0 0 1 5.91 12.12l4.23 4.23a1 1 0 1 1-1.42 1.42l-4.23-4.23A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />
            </svg>
            <input
              className="search-input"
              type="search"
              placeholder="Search a task by title"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <div className="input-wrap">
            <input
              className="task-input"
              type="text"
              placeholder="Add a task by title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              maxLength={120}
            />
            <div className="due-field">
              <label className="field-label" htmlFor="new-due-at">
                Due date and time
              </label>
              <input
                id="new-due-at"
                className="task-input due-input"
                type="datetime-local"
                value={newDueAt}
                onChange={(event) => setNewDueAt(event.target.value)}
                aria-label="Due date and time"
              />
            </div>
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
                    <div className="due-field">
                      <label className="field-label" htmlFor={`edit-due-at-${item.id}`}>
                        Due date and time
                      </label>
                      <input
                        id={`edit-due-at-${item.id}`}
                        className="edit-input due-input"
                        type="datetime-local"
                        value={editDueAt}
                        onChange={(event) => setEditDueAt(event.target.value)}
                        aria-label="Edit due date and time"
                      />
                    </div>
                    <button className="mini-btn save" type="button" onClick={() => saveEdit(item)}>
                      Save
                    </button>
                    <button className="mini-btn cancel" type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="task-main">
                      <p className={`task-title ${item.status ? "done" : ""}`}>{item.title}</p>
                      <p className="due-text">{formatDueAtDisplay(item.dueAt)}</p>
                    </div>
                    <div className="row-actions">
                      <button
                        className="icon-action edit"
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label="Edit task"
                        data-tooltip="Edit"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58ZM20.7 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0l-1.52 1.52 3.75 3.75 1.51-1.53Z" />
                        </svg>
                      </button>
                      <button
                        className="icon-action delete"
                        type="button"
                        onClick={() => onDelete(item.id)}
                        aria-label="Delete task"
                        data-tooltip="Delete"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Zm-1 12h12a2 2 0 0 0 2-2V8H4v11a2 2 0 0 0 2 2Z" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
