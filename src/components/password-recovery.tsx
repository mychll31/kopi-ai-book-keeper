"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import KopiLogo from "./kopi-logo";
import "./login-screen.css";

export default function PasswordRecovery() {
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function findQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/password-reset?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the recovery question.");
      setQuestion(data.question);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, answer: form.get("answer"), password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset your password.");
      setMessage(data.message);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="recovery-title">
        <a href="/" className="brand login-brand" aria-label="Kopi home">
          <KopiLogo />Kopi<span className="brand-dot">.</span>
        </a>
        <h1 id="recovery-title">Forgot password?</h1>
        <p>{question ? "Answer your recovery question and choose a new password." : "Enter your account email to see your recovery question."}</p>
        {message ? (
          <p role="status">{message}</p>
        ) : question ? (
          <form onSubmit={reset}>
            <p className="recovery-email">{email}</p>
            <label htmlFor="recovery-answer">{question}</label>
            <input id="recovery-answer" name="answer" type="password" autoComplete="off" required disabled={busy} />
            <label htmlFor="new-password">New password</label>
            <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={busy} placeholder="At least 10 characters" />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>{busy ? "Updating…" : "Reset password"}<ArrowRight size={18} /></button>
            <button type="button" className="text-button login-signup" disabled={busy} onClick={() => { setQuestion(""); setError(""); }}>Use another email</button>
          </form>
        ) : (
          <form onSubmit={findQuestion}>
            <label htmlFor="recovery-email">Email</label>
            <input id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy} />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>{busy ? "Checking…" : "Continue"}<ArrowRight size={18} /></button>
          </form>
        )}
        <a className="text-button login-signup" href="/">Back to sign in</a>
      </section>
    </main>
  );
}
