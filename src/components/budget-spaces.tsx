"use client";
import { useState } from "react";
import { Layers, Plus } from "lucide-react";
import type { BudgetSpace } from "@/lib/budget-spaces";
import "./budget-spaces.css";
export default function BudgetSpaces({
  spaces,
  selected,
  onSelect,
  onChanged,
  manage = true,
}: {
  spaces: BudgetSpace[];
  selected: string;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
  manage?: boolean;
}) {
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = spaces.find((s) => s.active);
  const [editing, setEditing] = useState(""),
    [editName, setEditName] = useState("");
  async function update(body: object, select = false) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/budget-spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to update spaces.");
      await onChanged();
      onSelect(select ? data.id : selected);
      setName("");
      setEditing("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="budget-switcher" aria-label="Budget Spaces">
      <label className="budget-view">
        <span>
          <Layers size={17} /> Budget Space
        </span>
        <select
          value={selected}
          disabled={!spaces.length || busy}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="View Budget Space"
        >
          {!spaces.length && <option value="">Loading spaces…</option>}
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.active ? " · Active" : ""}
            </option>
          ))}
        </select>
      </label>
      <p>
        {active ? (
          <>
            New transactions go to <strong>{active.name}</strong>.
          </>
        ) : (
          "No active space. Activate one before adding transactions."
        )}{" "}
        Viewing a space does not activate it.
      </p>
      {manage && (
        <details open>
          <summary>Manage Budget Spaces</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update({ action: "create", name }, true);
            }}
          >
            <label className="sr-only" htmlFor="space-name">
              New Budget Space name
            </label>
            <input
              id="space-name"
              required
              maxLength={80}
              placeholder="New space, e.g. Travel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <button className="primary" disabled={busy || !name.trim()}>
              <Plus size={16} /> Create & activate
            </button>
          </form>
          <ul>
            {spaces.map((s) => (
              <li key={s.id}>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {s.active
                      ? "Active · receives new transactions"
                      : "Inactive · records kept"}
                  </small>
                </span>
                <div className="budget-row-actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditing(s.id);
                      setEditName(s.name);
                      setError("");
                    }}
                  >
                    Edit name
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      update(
                        {
                          action: s.active ? "deactivate" : "activate",
                          id: s.id,
                        },
                        !s.active,
                      )
                    }
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                update({ action: "rename", id: editing, name: editName });
              }}
            >
              <label className="sr-only" htmlFor="edit-space-name">
                Budget Space name
              </label>
              <input
                id="edit-space-name"
                autoFocus
                required
                maxLength={80}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={busy}
              />
              <button className="primary" disabled={busy || !editName.trim()}>
                Save name
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditing("")}
              >
                Cancel
              </button>
            </form>
          )}
          {busy && <p role="status">Updating spaces…</p>}
        </details>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
