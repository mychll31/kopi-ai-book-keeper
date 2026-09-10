"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Bot, Sparkles, ExternalLink } from "lucide-react";
import "./integration-settings.css";
type Settings = {
  ready: boolean;
  groqConfigured: boolean;
  model: string;
  telegramConfigured: boolean;
  username: string;
  linked: boolean;
};
export default function IntegrationSettings({
  demo = false,
}: {
  demo?: boolean;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState(""),
    [token, setToken] = useState(""),
    [model, setModel] = useState("qwen/qwen3.6-27b");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [link, setLink] = useState("");
  async function refresh() {
    if (demo) return;
    const response = await fetch("/api/integrations");
    if (!response.ok) throw new Error("Unable to load settings.");
    const data = await response.json();
    setSettings(data);
    setModel(data.model);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [demo]);
  async function action(body: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to save settings.");
      setKey("");
      setToken("");
      if (data.link) setLink(data.link);
      else {
        setLink("");
        setNotice(data.warning || "Settings updated.");
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const disabled = demo || busy || !settings?.ready;
  return (
    <section className="integration-settings">
      <h2>Receipt automation</h2>
      <p>
        Send a receipt image to your Telegram bot. Groq reads it and adds a
        credit or debit, with the image attached.
      </p>
      <p className="w-field-hint">
        Images and captions are sent to Groq using your API key. API usage may
        incur charges. Only PHP receipts, one image at a time, up to 2 MB.
        Review AI-created entries in Transactions.
      </p>
      {demo ? (
        <p className="w-field-hint">
          Sign in to connect your own bot and API key.
        </p>
      ) : !settings ? (
        <p>Loading settings…</p>
      ) : (
        !settings.ready && (
          <p className="error">
            Server encryption is not configured yet. Contact the app
            administrator.
          </p>
        )
      )}
      <div className="integration-section">
        <h3>
          <Sparkles size={20} /> Groq settings
        </h3>
        <p>
          {settings?.groqConfigured
            ? "API key saved securely. Leave blank to keep it."
            : "Add your Groq API key—not your Groq login password."}
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            action({ action: "groq", key, model });
          }}
        >
          <label>
            Groq API key
            <input
              type="password"
              autoComplete="new-password"
              value={key}
              maxLength={512}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                settings?.groqConfigured ? "•••••••• (saved)" : "gsk_…"
              }
              disabled={disabled}
            />
          </label>
          <label>
            Image-reading model
            <input
              value={model}
              maxLength={100}
              onChange={(e) => setModel(e.target.value)}
              disabled={disabled}
            />
          </label>
          <p className="w-field-hint">
            Choose an image-capable model available to your Groq account.
          </p>
          <div className="integration-actions">
            <button
              className="primary"
              disabled={disabled || (!key && !settings?.groqConfigured)}
            >
              Save & verify Groq
            </button>
            {settings?.groqConfigured && (
              <button
                type="button"
                className="text-button"
                disabled={disabled}
                onClick={() => {
                  if (confirm("Remove the Groq key and stop receipt reading?"))
                    action({ action: "remove-groq" });
                }}
              >
                Remove key
              </button>
            )}
          </div>
        </form>
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Groq console <ExternalLink size={13} />
        </a>
      </div>
      <div className="integration-section">
        <h3>
          <Bot size={20} /> Telegram settings
        </h3>
        <p>
          Create a dedicated bot with{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
          >
            BotFather
          </a>{" "}
          using /newbot, then paste its token here. A bot can connect to only
          one Kopi account.
        </p>
        {settings?.telegramConfigured ? (
          <>
            <p className="integration-status">
              @{settings.username} ·{" "}
              {settings.linked ? "Private chat linked" : "Chat not linked yet"}
            </p>
            <div className="integration-actions">
              <button
                className="secondary"
                disabled={disabled}
                onClick={() => action({ action: "link" })}
              >
                {settings.linked
                  ? "Relink Telegram chat"
                  : "Link my Telegram chat"}
              </button>
              <button
                className="text-button"
                disabled={disabled}
                onClick={() => {
                  if (
                    confirm(
                      "Disconnect Telegram? Existing transactions stay in Kopi.",
                    )
                  )
                    action({ action: "disconnect" });
                }}
              >
                Disconnect
              </button>
            </div>
            {link && (
              <p>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  Open Telegram and tap Start <ExternalLink size={13} />
                </a>
                <br />
                <small>
                  Private, one-time link. Expires in 10 minutes. Do not share
                  it.
                </small>
              </p>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => refresh().catch((e) => setError(e.message))}
            >
              Refresh connection status
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action({ action: "telegram", token });
            }}
          >
            <label>
              Bot token
              <input
                type="password"
                autoComplete="new-password"
                value={token}
                maxLength={200}
                onChange={(e) => setToken(e.target.value)}
                disabled={disabled}
                placeholder="123456789:…"
              />
            </label>
            <button className="primary" disabled={disabled || !token}>
              Connect bot
            </button>
            <button
              type="button"
              className="text-button"
              disabled={disabled}
              onClick={() => action({ action: "disconnect" })}
            >
              Reset incomplete connection
            </button>
          </form>
        )}
        <p className="w-field-hint">
          Only the linked private chat can add transactions. Unclear
          credit/debit direction asks for confirmation; unreadable receipts are
          not saved. Repeated delivery of the same Telegram message will not add
          it twice.
        </p>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Saving…</p>}
    </section>
  );
}
