"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Check,
  Download,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { cents, type Entry } from "@/lib/ledger";
import { DEFAULT_TYPES, defaultIcon } from "@/lib/transaction-types";
import TypePicker from "@/components/type-picker";
import LoginScreen from "@/components/login-screen";
import KopiLogo from "@/components/kopi-logo";
import Workspace from "@/components/workspace";
import type { BudgetSpace } from "@/lib/budget-spaces";
import "@/components/transaction-form.css";
type Account = { id: string; name: string; email: string };
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
async function api(url: string, options?: RequestInit) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export default function Home() {
  const [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]),
    [customTypes, setCustomTypes] = useState<string[]>([]);
  const [spaces, setSpaces] = useState<BudgetSpace[]>([]);
  function applyLedger(data: { entries: Entry[]; spaces: BudgetSpace[] }) {
    setEntries(data.entries);
    setSpaces(data.spaces);
  }
  const [editor, setEditor] = useState<Entry | "new" | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState("login"),
    [authOpen, setAuthOpen] = useState(false),
    [installOpen, setInstallOpen] = useState(false),
    [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [entryType, setEntryType] = useState("debit"),
    [subscription, setSubscription] = useState(""),
    [receiptName, setReceiptName] = useState(""),
    [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typeIcons, setTypeIcons] = useState<Record<string, string>>({});
  const iconFor = (name: string) =>
    typeIcons[name.toLowerCase()] || defaultIcon(name);
  const active = !!account || demo;
  const types = [
    ...new Map(
      [
        ...DEFAULT_TYPES,
        ...customTypes,
        ...entries.map((e) => e.subscription).filter(Boolean),
      ].map((name) => [name.toLowerCase(), name]),
    ).values(),
  ];
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api("/api/auth");
        if (cancelled) return;
        setAccount(d.user);
        if (d.user) {
          const rows = await api("/api/entries");
          if (!cancelled) applyLedger(rows);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const listener = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", listener);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setCustomTypes([]);
    setAuthMode("login");
    setTypeIcons({});
    if (account)
      api("/api/transaction-types")
        .then((d) => {
          if (!cancelled) {
            setCustomTypes(d.types);
            setTypeIcons(d.icons || {});
          }
        })
        .catch((e) => {
          if (!cancelled) setNotice(e.message);
        });
    return () => {
      cancelled = true;
    };
  }, [account?.id]);
  useEffect(() => {
    if (!account || demo) return;
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || editor) return;
      try {
        const data = await api("/api/entries");
        if (!cancelled) applyLedger(data);
      } catch {
        /* Keep the last successful view if temporarily offline. */
      }
    };
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [account?.id, demo, editor]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    if (editor || authOpen || installOpen || deleteTarget)
      dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [editor, authOpen, installOpen, deleteTarget]);
  function close() {
    if (busy) return;
    setAuthMode("login");
    setEditor(null);
    setAuthOpen(false);
    setInstallOpen(false);
    setDeleteTarget(null);
    setError("");
  }
  function openEditor(entry: Entry | "new" = "new") {
    if (!active) {
      setAuthOpen(true);
      return;
    }
    setError("");
    setEntryType(entry === "new" ? "debit" : entry.type);
    setSubscription(
      entry === "new"
        ? ""
        : ["", ...types].includes(entry.subscription)
          ? entry.subscription
          : "__custom__",
    );
    setReceiptName(entry === "new" ? "" : entry.receipt_name || "");
    setEditor(entry);
  }
  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const d = await api("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: authMode,
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      setAccount(d.user);
      applyLedger(await api("/api/entries"));
      setDemo(false);
      setAuthOpen(false);
      setNotice(
        authMode === "signup"
          ? "Your book is ready. Add your first transaction."
          : "Welcome back.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    data.set("type", entryType);
    if (subscription === "__custom__")
      data.set(
        "subscription",
        String(data.get("customSubscription") || "").trim(),
      );
    else data.set("subscription", subscription);
    try {
      if (demo) {
        const amount = cents(String(data.get("amount")));
        const file = data.get("receipt") as File;
        const item: Entry = {
          id: editor !== "new" && editor ? editor.id : crypto.randomUUID(),
          date: String(data.get("date")),
          particular: String(data.get("particular")),
          subscription: String(data.get("subscription")),
          type: entryType as Entry["type"],
          amount,
          receipt_name: file?.size
            ? file.name
            : (data.get("remove_receipt") ? "" : receiptName) || null,
        };
        setEntries((old) =>
          [item, ...old.filter((x) => x.id !== item.id)].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        );
      } else {
        if (editor && editor !== "new") data.set("id", editor.id);
        await api("/api/entries", { method: "POST", body: data });
        applyLedger(await api("/api/entries"));
      }
      setEditor(null);
      setNotice(
        demo
          ? "Demo updated. Create an account to save your records."
          : "Transaction saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (!demo)
        await api("/api/entries?id=" + deleteTarget.id, { method: "DELETE" });
      setEntries((old) => old.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      setEditor(null);
      setNotice("Transaction deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addType(name: string, icon: string, update = false) {
    if (!name || name.length > 80)
      throw new Error("Enter a type name of 1–80 characters.");
    if (!update && types.some((t) => t.toLowerCase() === name.toLowerCase()))
      throw new Error("That transaction type already exists.");
    if (!demo)
      await api("/api/transaction-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon }),
      });
    setCustomTypes((old) => [...new Set([...old, name])]);
    setTypeIcons((old) => ({ ...old, [name.toLowerCase()]: icon }));
  }
  async function updateProfile(name: string) {
    const d = await api("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setAccount(d.user);
  }
  async function logout() {
    if (account) await api("/api/auth", { method: "DELETE" });
    setAccount(null);
    setDemo(false);
    setEntries([]);
    setSpaces([]);
    setCustomTypes([]);
  }
  return (
    <div className={active ? "app-shell mobile-workspace" : "app-shell"}>
      {!active ? (
        <LoginScreen
          onSignup={() => {setError("");setAuthMode("signup");setAuthOpen(true);}}
          onSubmit={submitAuth}
          busy={busy}
          loading={loading}
          error={error}
        />
      ) : (
        <Workspace
          account={account}
          entries={entries}
          spaces={spaces}
          onSpacesChanged={async () => {
            applyLedger(await api("/api/entries"));
          }}
          demo={demo}
          loading={loading}
          types={types}
          iconFor={iconFor}
          onAdd={(type) => {
            openEditor();
            setEntryType(type);
          }}
          onEdit={openEditor}
          onAddType={addType}
          onProfile={updateProfile}
          onLogout={logout}
          onSignup={() => {
            setAuthMode("signup");
            setAuthOpen(true);
          }}
          onInstall={() => setInstallOpen(true)}
          onNotice={setNotice}
        />
      )}
      {active && error && !editor && !authOpen && !deleteTarget && (
        <div className="toast" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className={editor ? "transaction-dialog" : undefined}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="dialog-content">
          <button
            className="dialog-close icon-button"
            aria-label="Close dialog"
            onClick={close}
            disabled={busy}
          >
            <X size={21} />
          </button>
          {deleteTarget ? (
            <>
              <h2>Delete this transaction?</h2>
              <p>
                “{deleteTarget.particular}” and its receipt will be permanently
                removed.
              </p>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div className="form-actions">
                <button
                  className="secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={busy}
                >
                  Keep transaction
                </button>
                <button className="danger" onClick={remove} disabled={busy}>
                  {busy ? "Deleting…" : "Delete transaction"}
                </button>
              </div>
            </>
          ) : editor ? (
            <>
              <div className="eyebrow">YOUR EVERYDAY BOOKS</div>
              <h2>
                {editor === "new" ? "Add a transaction" : "Edit transaction"}
              </h2>
              <p>Enter an amount and a short description.</p>
              <p className="w-field-hint">
                Budget Space:{" "}
                {editor === "new"
                  ? spaces.find((s) => s.active)?.name || "None active"
                  : spaces.find((s) => s.id === editor.space_id)?.name ||
                    "Personal"}
                {editor === "new"
                  ? " · saved to the active space"
                  : " · choose another space below to move it"}
              </p>
              <form onSubmit={save}>
                {editor !== "new" && (
                  <label>
                    Budget Space
                    <select
                      name="space_id"
                      defaultValue={editor.space_id}
                      required
                    >
                      {spaces.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.active ? " · Active" : " · Inactive"}
                        </option>
                      ))}
                    </select>
                    <small className="optional">
                      Saving moves this transaction and its receipt together.
                      The active space stays unchanged.
                    </small>
                  </label>
                )}
                <div className="type-switch">
                  <button
                    type="button"
                    className={entryType === "credit" ? "chosen" : ""}
                    onClick={() => setEntryType("credit")}
                  >
                    <ArrowDownLeft size={17} /> Credit · money in
                  </button>
                  <button
                    type="button"
                    className={entryType === "debit" ? "chosen" : ""}
                    onClick={() => setEntryType("debit")}
                  >
                    <ArrowUpRight size={17} /> Debit · money out
                  </button>
                </div>
                <div className="form-row">
                  <label>
                    Date
                    <input
                      required
                      type="date"
                      name="date"
                      defaultValue={editor === "new" ? today() : editor.date}
                    />
                  </label>
                  <label>
                    Amount (PHP)
                    <input
                      required
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max="999999999.99"
                      step="0.01"
                      placeholder="0.00"
                      name="amount"
                      defaultValue={
                        editor === "new" ? "" : (editor.amount / 100).toFixed(2)
                      }
                    />
                  </label>
                </div>
                <label>
                  Description
                  <input
                    required
                    name="particular"
                    maxLength={200}
                    placeholder={
                      entryType === "credit"
                        ? "e.g. Received from HRazon"
                        : "e.g. Lunch"
                    }
                    defaultValue={editor === "new" ? "" : editor.particular}
                  />
                </label>
                <details className="w-optional" open={editor !== "new"}>
                  <summary>
                    Type & receipt <span className="optional">optional</span>
                  </summary>
                  <div className="type-field">
                    <p>
                      Transaction type{" "}
                      <span className="optional">optional</span>
                    </p>
                    <TypePicker
                      types={types}
                      value={subscription}
                      onChange={setSubscription}
                      iconFor={iconFor}
                    />
                  </div>
                  <label className="upload-label">
                    Receipt <span className="optional">optional</span>
                    <span className="upload-box">
                      <Upload size={22} />
                      <strong>
                        {receiptName || "Choose a receipt or take a photo"}
                      </strong>
                      <small>JPG, PNG, WebP, or PDF · up to 2 MB</small>
                      <input
                        aria-label="Upload receipt"
                        type="file"
                        name="receipt"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && f.size > 2 * 1024 * 1024) {
                            setError("Receipt must be 2 MB or smaller.");
                            e.target.value = "";
                            return;
                          }
                          setError("");
                          setReceiptName(f?.name || "");
                        }}
                      />
                    </span>
                  </label>
                  {editor !== "new" && editor.receipt_name && (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="remove_receipt"
                        value="true"
                      />{" "}
                      Remove existing receipt
                    </label>
                  )}
                </details>
                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}
                <div className="form-actions">
                  {editor !== "new" ? (
                    <button
                      className="delete-link"
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleteTarget(editor)}
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      type="button"
                      onClick={close}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  )}
                  <button className="primary" disabled={busy}>
                    {busy ? (
                      "Saving…"
                    ) : (
                      <>
                        <Check size={17} /> Save transaction
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : authOpen ? (
            <>
              <KopiLogo />
              <h2>
                {authMode === "signup"
                  ? "A fresh page starts here."
                  : "Welcome back."}
              </h2>
              <p>
                {authMode === "signup"
                  ? "Create your personal book and keep it with you on every device."
                  : "Sign in to pick up where you left off."}
              </p>
              <form onSubmit={submitAuth}>
                {authMode === "signup" && (
                  <label>
                    Your name
                    <input
                      name="name"
                      autoComplete="name"
                      maxLength={80}
                      required
                      placeholder="What should we call you?"
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      authMode === "signup"
                        ? "new-password"
                        : "current-password"
                    }
                    minLength={10}
                    maxLength={128}
                    required
                    placeholder="At least 10 characters"
                  />
                </label>
                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}
                <button className="primary full-width" disabled={busy}>
                  {busy
                    ? "One moment…"
                    : authMode === "signup"
                      ? "Create account"
                      : "Sign in"}
                  <ArrowRight size={17} />
                </button>
              </form>
              <button
                className="text-button auth-switch"
                onClick={() => {
                  setAuthMode(authMode === "signup" ? "login" : "signup");
                  setError("");
                }}
              >
                {authMode === "signup"
                  ? "Already have an account? Sign in"
                  : "New to Kopi? Create an account"}
              </button>
            </>
          ) : installOpen ? (
            <>
              <span className="install-icon">
                <Smartphone size={30} />
              </span>
              <h2>Your books, in your pocket.</h2>
              <p>
                Install Kopi on your home screen for easy access. Sign in with
                the same account on every device.
              </p>
              {installPrompt ? (
                <button
                  className="primary full-width"
                  onClick={async () => {
                    await installPrompt.prompt();
                    const result = await installPrompt.userChoice;
                    if (result.outcome === "accepted") setInstallOpen(false);
                    setInstallPrompt(null);
                  }}
                >
                  Install Kopi <Download size={17} />
                </button>
              ) : (
                <div className="install-steps">
                  <h3>On iPhone or iPad</h3>
                  <p>
                    Open this site in Safari, tap Share, then “Add to Home
                    Screen.”
                  </p>
                  <h3>On Android</h3>
                  <p>
                    <a
                      href="/downloads/pocketbook-android.apk"
                      className="text-button"
                    >
                      Download the Android APK
                    </a>{" "}
                    to install Kopi directly. This is a development build for
                    testing.
                  </p>
                  <p>
                    Open this site in Chrome, tap the ⋮ menu, then “Install app”
                    or “Add to Home screen.”
                  </p>
                </div>
              )}
              <small className="muted">
                An internet connection is needed to view and save your records.
              </small>
            </>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
