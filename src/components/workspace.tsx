"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  Check,
  Download,
  FileText,
  LogOut,
  Plus,
  Search,
  Smartphone,
  Tags,
  UserRound,
  Wallet,
} from "lucide-react";
import KopiLogo from "./kopi-logo";
import IntegrationSettings from "./integration-settings";
import BudgetSpaces from "./budget-spaces";
import type { BudgetSpace } from "@/lib/budget-spaces";
import { IconPicker, TypeIcon } from "./type-picker";
import { csv, totals, type Entry } from "@/lib/ledger";
import "./workspace.css";

type Account = { id: string; name: string; email: string };
type Props = {
  account: Account | null;
  entries: Entry[];
  spaces: BudgetSpace[];
  onSpacesChanged: () => Promise<void>;
  demo: boolean;
  loading: boolean;
  types: string[];
  onAdd: (type: Entry["type"]) => void;
  onEdit: (entry: Entry) => void;
  onAddType: (name: string, icon: string, update?: boolean) => Promise<void>;
  iconFor: (name: string) => string;
  onProfile: (name: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onSignup: () => void;
  onInstall: () => void;
  onNotice: (message: string) => void;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n / 100,
  );
const date = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const menus = [
  { name: "Overview", icon: BarChart3 },
  { name: "Transactions", icon: ArrowDownLeft },
  { name: "Transaction types", icon: Tags },
  { name: "Profile", icon: UserRound },
];

export default function Workspace(p: Props) {
  const [chosenSpace, setChosenSpace] = useState("");
  const activeSpace = p.spaces.find((s) => s.active);
  const selectedSpace = p.spaces.some((s) => s.id === chosenSpace)
    ? chosenSpace
    : activeSpace?.id || p.spaces[0]?.id || "";
  const scopedEntries = p.entries.filter((e) => e.space_id === selectedSpace);
  const activeEntries = activeSpace
    ? p.entries.filter((e) => e.space_id === activeSpace.id)
    : [];
  const [view, setView] = useState("Overview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [month, setMonth] = useState("all");
  const [typeName, setTypeName] = useState(""),
    [name, setName] = useState(p.account?.name || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const [newIcon, setNewIcon] = useState("tag");
  const [editingType, setEditingType] = useState("");
  useEffect(() => {
    setName(p.account?.name || "");
  }, [p.account?.name]);
  useEffect(() => {
    let frame = 0;
    const viewport = window.visualViewport;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nav = navRef.current;
        if (!nav) return;
        nav.style.setProperty(
          "--nav-top",
          `${(viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - nav.offsetHeight}px`,
        );
        nav.style.setProperty("--nav-left", `${viewport?.offsetLeft || 0}px`);
        nav.style.setProperty(
          "--nav-width",
          `${viewport?.width || innerWidth}px`,
        );
      });
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);
  const summary = totals(activeEntries);
  const rows = scopedEntries.filter(
    (e) =>
      (filter === "all" || e.type === filter) &&
      (month === "all" || e.date.startsWith(month)) &&
      (e.particular + " " + e.subscription)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const months = [...new Set(scopedEntries.map((e) => e.date.slice(0, 7)))]
    .sort()
    .reverse();
  const now = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) +
      "T12:00:00",
  );
  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: d.toLocaleDateString("en-US", { month: "short" }),
      key,
      ...totals(activeEntries.filter((e) => e.date.startsWith(key))),
    };
  });
  const max = Math.max(100, ...chart.flatMap((c) => [c.credit, c.debit]));
  const chartTotals = chart.reduce(
    (s, c) => ({ credit: s.credit + c.credit, debit: s.debit + c.debit }),
    { credit: 0, debit: 0 },
  );
  function navigate(next: string) {
    setView(next);
    setError("");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  async function addType(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await p.onAddType(typeName.trim(), newIcon);
      setTypeName("");
      p.onNotice("Transaction type added.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await p.onProfile(name.trim());
      p.onNotice("Profile updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportRows() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv(rows)], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "kopi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="workspace-v2">
      <header className="w-header">
        <a href="/" className="brand">
          <KopiLogo />
          Kopi<span className="brand-dot">.</span>
        </a>
        <nav className="w-desktop-nav" aria-label="Main navigation">
          {menus.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navigate(name)}
              aria-current={view === name ? "page" : undefined}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>
        <button
          className="w-avatar"
          aria-label="Open profile"
          onClick={() => navigate("Profile")}
        >
          {p.account?.name.slice(0, 2).toUpperCase() || "ME"}
        </button>
      </header>
      <main className="w-main">
        {view === "Transactions" && (
          <BudgetSpaces
            spaces={p.spaces}
            selected={selectedSpace}
            onSelect={setChosenSpace}
            onChanged={p.onSpacesChanged}
            manage={false}
          />
        )}
        {p.demo && (
          <div className="w-demo">
            <span>Demo · changes aren’t saved</span>
            <button onClick={p.onSignup}>
              Create account <ArrowRight size={13} />
            </button>
          </div>
        )}
        <div className="w-heading">
          <h1>{view}</h1>
          <p>
            {view === "Overview"
              ? "Your money, simply explained."
              : view === "Transactions"
                ? "Money in. Money out. All in one place."
                : view === "Transaction types"
                  ? "Choose how you organize your transactions."
                  : "Your account and personal details."}
          </p>
        </div>
        {view === "Overview" && (
          <>
            <section className="w-balance">
              <span>
                <Wallet size={18} /> Available balance
              </span>
              <strong>{money(summary.balance)}</strong>
              <small>
                {activeSpace
                  ? `${activeSpace.name} · active Budget Space · all time`
                  : "No active Budget Space"}
              </small>
            </section>
            <div className="w-totals">
              <div>
                <span>
                  <ArrowDownLeft size={16} /> Active total credit
                </span>
                <strong>{money(summary.credit)}</strong>
              </div>
              <div>
                <span>
                  <ArrowUpRight size={16} /> Active total debit
                </span>
                <strong>{money(summary.debit)}</strong>
              </div>
            </div>
            <section className="w-chart">
              <div className="w-section-heading">
                <h2>Cash flow</h2>
                <span>Last 6 months</span>
              </div>
              <div className="w-chart-legend">
                <span>
                  <i />
                  Credit
                </span>
                <span>
                  <i />
                  Debit
                </span>
              </div>
              <div
                className="w-chart-area"
                role="img"
                aria-label={`Monthly credit and debit, ${chart[0].label} to ${chart[5].label}. Credit ${money(chartTotals.credit)}. Debit ${money(chartTotals.debit)}.`}
              >
                {chart.map((c) => (
                  <div key={c.key} className="w-chart-column">
                    <div className="w-bars">
                      <div
                        className="w-credit-bar"
                        style={{ height: `${(c.credit / max) * 100}%` }}
                        title={`${c.label} credit: ${money(c.credit)}`}
                      />
                      <div
                        className="w-debit-bar"
                        style={{ height: `${(c.debit / max) * 100}%` }}
                        title={`${c.label} debit: ${money(c.debit)}`}
                      />
                    </div>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
              {chartTotals.credit + chartTotals.debit === 0 && (
                <p className="w-chart-empty">
                  No transactions in this period yet.
                </p>
              )}
              <details className="w-chart-details">
                <summary>View monthly amounts</summary>
                {chart.map((c) => (
                  <div key={c.key}>
                    <span>
                      {c.label} {c.key.slice(0, 4)}
                    </span>
                    <span>Credit {money(c.credit)}</span>
                    <span>Debit {money(c.debit)}</span>
                  </div>
                ))}
              </details>
            </section>
            <button
              className="w-forward"
              onClick={() => navigate("Transactions")}
            >
              Go to transactions <ArrowRight size={18} />
            </button>
          </>
        )}
        {view === "Transactions" && (
          <>
            <div className="w-add-actions">
              <button
                className="primary"
                disabled={!p.spaces.some((s) => s.active)}
                onClick={() => p.onAdd("credit")}
              >
                <Plus size={18} /> Add credit
              </button>
              <button
                className="secondary"
                disabled={!p.spaces.some((s) => s.active)}
                onClick={() => p.onAdd("debit")}
              >
                <Plus size={18} /> Add debit
              </button>
            </div>
            <section className="w-transactions">
              <div className="w-filters">
                <div className="tabs">
                  {[
                    ["all", "All"],
                    ["credit", "Credit"],
                    ["debit", "Debit"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? "active" : ""}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Transaction month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  <option value="all">All time</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {new Date(m + "-01T12:00:00").toLocaleDateString(
                        "en-US",
                        { month: "short", year: "numeric" },
                      )}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  aria-label="Export visible transactions to CSV"
                  disabled={!rows.length}
                  onClick={exportRows}
                >
                  <Download size={18} />
                </button>
              </div>
              <label className="w-search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search transactions"
                  aria-label="Search transactions"
                />
              </label>
              {p.loading ? (
                <p className="w-empty">Loading transactions…</p>
              ) : rows.length ? (
                rows.map((e) => (
                  <article className="w-entry" key={e.id}>
                    <button
                      className="w-entry-edit"
                      onClick={() => p.onEdit(e)}
                      aria-label={`Edit ${e.particular}`}
                    >
                      <span className={"w-entry-icon " + e.type}>
                        {e.subscription ? (
                          <TypeIcon icon={p.iconFor(e.subscription)} />
                        ) : e.type === "credit" ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </span>
                      <span className="w-entry-description">
                        <strong>{e.particular}</strong>
                        <small>
                          {date(e.date)}
                          {e.subscription ? " · " + e.subscription : ""}
                        </small>
                      </span>
                      <span className={"w-entry-amount " + e.type}>
                        {e.type === "credit" ? "+" : "−"}
                        {money(e.amount)}
                      </span>
                    </button>
                    {e.receipt_name && (
                      <a
                        className="w-entry-receipt"
                        href={p.demo ? "#" : "/api/receipts/" + e.id}
                        target={p.demo ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          if (p.demo) {
                            event.preventDefault();
                            p.onNotice(
                              "Receipts are available with a saved account.",
                            );
                          }
                        }}
                      >
                        <FileText size={13} /> View receipt
                      </a>
                    )}
                  </article>
                ))
              ) : (
                <div className="w-empty">
                  <p>
                    {search || filter !== "all" || month !== "all"
                      ? "No matching transactions."
                      : "No transactions yet."}
                  </p>
                  <small>
                    Add a credit for money received or a debit for money spent.
                  </small>
                </div>
              )}
              <div className="w-list-footer">
                {rows.length} transaction{rows.length !== 1 ? "s" : ""} · Tap an
                entry to edit
              </div>
            </section>
          </>
        )}
        {view === "Transaction types" && (
          <section className="w-types">
            <BudgetSpaces
              spaces={p.spaces}
              selected={selectedSpace}
              onSelect={setChosenSpace}
              onChanged={p.onSpacesChanged}
            />
            <div className="w-type-help">
              <Tags size={20} />
              <p>
                Types are labels such as Food, Salary, or ChatGPT. Choose one
                when adding a credit or debit.
              </p>
            </div>
            <p className="w-field-hint">Choose an icon for your new type.</p>
            <IconPicker value={newIcon} onChange={setNewIcon} disabled={busy} />
            <form onSubmit={addType} className="w-add-type">
              <input
                aria-label="New transaction type"
                placeholder="New type, e.g. Rent"
                required
                maxLength={80}
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
              />
              <button className="primary" disabled={busy || !typeName.trim()}>
                <Plus size={17} />
                {busy ? "Adding…" : "Add"}
              </button>
            </form>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p className="w-field-hint">Tap a type’s icon to change it.</p>
            {editingType && (
              <div className="w-icon-edit">
                <strong>Icon for {editingType}</strong>
                <IconPicker
                  value={p.iconFor(editingType)}
                  disabled={busy}
                  onChange={async (icon) => {
                    setBusy(true);
                    setError("");
                    try {
                      await p.onAddType(editingType, icon, true);
                      setEditingType("");
                      p.onNotice("Icon updated.");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setEditingType("")}
                >
                  Cancel
                </button>
              </div>
            )}
            <ul className="w-type-list">
              {p.types.map((type) => (
                <li key={type}>
                  <button
                    className="w-type-symbol"
                    aria-label={"Change icon for " + type}
                    onClick={() => setEditingType(type)}
                  >
                    <TypeIcon icon={p.iconFor(type)} />
                  </button>
                  <strong>{type}</strong>
                  <span>
                    {
                      scopedEntries.filter(
                        (e) =>
                          e.subscription.toLowerCase() === type.toLowerCase(),
                      ).length
                    }{" "}
                    entries
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {view === "Profile" && (
          <section className="w-profile">
            <div className="w-profile-intro">
              <span className="w-profile-avatar">
                <UserRound size={27} />
              </span>
              <div>
                <h2>{p.account?.name || "Demo account"}</h2>
                <p>{p.account?.email || "Explore Kopi before signing up."}</p>
              </div>
            </div>
            {p.account ? (
              <form onSubmit={saveProfile}>
                <label>
                  Full name
                  <input
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Email address
                  <input value={p.account.email} type="email" readOnly />
                </label>
                <p className="w-field-hint">Your email is used to sign in.</p>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="primary"
                  disabled={
                    busy || !name.trim() || name.trim() === p.account.name
                  }
                >
                  <Check size={16} />
                  {busy ? "Saving…" : "Save details"}
                </button>
              </form>
            ) : (
              <button className="primary" onClick={p.onSignup}>
                Create your account <ArrowRight size={17} />
              </button>
            )}
            <IntegrationSettings demo={p.demo} />
            <dl className="w-profile-info">
              <div>
                <dt>Currency</dt>
                <dd>Philippine peso (PHP)</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>{p.demo ? "Demo" : "Personal"}</dd>
              </div>
            </dl>
            <button className="w-profile-action" onClick={p.onInstall}>
              <Smartphone size={18} /> Install on your phone{" "}
              <ArrowRight size={16} />
            </button>
            <button
              className="w-profile-action w-signout"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await p.onLogout();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut size={18} />
              {p.demo ? "Exit demo" : "Sign out"}
            </button>
          </section>
        )}
      </main>
      <nav
        className="mobile-bottom-nav w-mobile-nav"
        ref={navRef}
        aria-label="Mobile navigation"
      >
        {menus.map(({ name, icon: Icon }) => (
          <button
            key={name}
            aria-current={name === view ? "page" : undefined}
            className={name === view ? "is-active" : ""}
            onClick={(e) => {
              navigate(name);
              if (e.detail > 0) e.currentTarget.blur();
            }}
          >
            <span className="mobile-bottom-icon">
              <Icon size={21} />
            </span>
            <span>{name === "Transaction types" ? "Types" : name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
