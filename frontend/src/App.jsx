import { useEffect, useMemo, useRef, useState } from "react";

const FILTERS = ["All", "Active", "Done"];

const api = {
  async list() {
    const res = await fetch("/todos");
    if (!res.ok) throw new Error("Failed to load todos.");
    return res.json();
  },
  async create(title) {
    const res = await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error("Failed to create todo.");
    return res.json();
  },
  async toggle(id) {
    const res = await fetch(`/todos/${id}/status`, { method: "PATCH" });
    if (!res.ok) throw new Error("Failed to update status.");
    return res.json();
  },
  async remove(id) {
    const res = await fetch(`/todos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete todo.");
  },
  async clearDone() {
    const res = await fetch("/todos/status/true", { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to clear completed todos.");
  },
  async update(id, payload) {
    const res = await fetch(`/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to update todo.");
    return res.json();
  }
};

export default function App() {
  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingEditId, setSavingEditId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastCounter = useRef(0);

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

  const loadTodos = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.list();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodos();
  }, []);

  const pushToast = (variant, message) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, variant, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  };

  const onAdd = async (event) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || submitting) return;

    setSubmitting(true);
    setError("");
    const tempId = -Date.now();
    setItems((prev) => [...prev, { id: tempId, title, status: false }]);
    setNewTitle("");

    try {
      const created = await api.create(title);
      setItems((prev) => prev.map((item) => (item.id === tempId ? created : item)));
      pushToast("success", "Task added.");
    } catch (err) {
      setItems((prev) => prev.filter((item) => item.id !== tempId));
      setNewTitle(title);
      setError(err.message);
      pushToast("error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onToggle = async (id) => {
    setError("");
    const previous = items;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: !item.status } : item))
    );

    try {
      await api.toggle(id);
      pushToast("success", "Status updated.");
    } catch (err) {
      setItems(previous);
      setError(err.message);
      pushToast("error", err.message);
    }
  };

  const onDelete = async (id) => {
    setError("");
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      await api.remove(id);
      pushToast("success", "Task deleted.");
    } catch (err) {
      setItems(previous);
      setError(err.message);
      pushToast("error", err.message);
    }
  };

  const onClearDone = async () => {
    if (counts.done === 0) return;
    setError("");
    const previous = items;
    setItems((prev) => prev.filter((item) => !item.status));

    try {
      await api.clearDone();
      pushToast("success", "Done tasks cleared.");
    } catch (err) {
      setItems(previous);
      setError(err.message);
      pushToast("error", err.message);
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
    const title = editTitle.trim();
    if (!title) {
      setError("Title cannot be empty.");
      pushToast("error", "Title cannot be empty.");
      return;
    }

    setError("");
    setSavingEditId(item.id);
    const previous = items;
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, title } : entry)));
    setEditingId(null);
    setEditTitle("");

    try {
      await api.update(item.id, { title, status: item.status });
      pushToast("success", "Task updated.");
    } catch (err) {
      setItems(previous);
      setError(err.message);
      pushToast("error", err.message);
    } finally {
      setSavingEditId(null);
    }
  };

  const onEditKeyDown = (event, item) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveEdit(item);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <div className="nav-left">
          <div className="brand-wrap">
            <span className="brand-dot" />
            <span className="brand-text">Task Desk</span>
          </div>
        </div>
        <div className="nav-meta">
          <span>{counts.total} total tasks</span>
          <span
            className="progress-chip"
            style={{ "--progress": progressPercent }}
            role="img"
            aria-label={`${progressPercent}% completed`}
            title={`${progressPercent}% completed`}
          >
            <span className="progress-chip-value">{progressPercent}</span>
            <span className="progress-chip-ring" />
          </span>
        </div>
      </nav>

      <section className="todo-panel">
        <header className="panel-top">
          <p className="eyebrow">Task Board</p>
          <h1 className="title">Professional Todo Workspace</h1>
          <p className="subtitle">Clean task tracking with status-first controls.</p>
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
            <span className="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.74 4.75-1.41 1.41-4.75-4.74A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />
              </svg>
            </span>
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
                  title={item.status ? "Mark as active" : "Mark as done"}
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
                      onKeyDown={(event) => onEditKeyDown(event, item)}
                      maxLength={120}
                      autoFocus
                    />
                    <button className="mini-btn save" type="button" onClick={() => saveEdit(item)}>
                      Save
                    </button>
                    <button className="mini-btn cancel" type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <span className="edit-hint">Enter to save, Esc to cancel</span>
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
    </main>
  );
}
