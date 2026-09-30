"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SUGGESTED_RECOVERY_QUESTION } from "@/lib/recovery-question";

export default function RecoverySettings({ userId }: { userId: string }) {
  const [question, setQuestion] = useState(SUGGESTED_RECOVERY_QUESTION);
  const [answer, setAnswer] = useState("");
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/recovery-question")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load recovery settings.");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setQuestion(data.configured ? data.question : SUGGESTED_RECOVERY_QUESTION);
          setConfigured(data.configured);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError((cause as Error).message);
      });
    return () => { cancelled = true; };
  }, [userId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/recovery-question", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save recovery settings.");
      setConfigured(true);
      setAnswer("");
      setNotice("Recovery question saved.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-recovery-settings">
      <h3>Account recovery</h3>
      <p>{configured ? "Update your recovery question and private answer." : "Set an answer now so you can recover this account if you forget your password."}</p>
      <form onSubmit={save}>
        <label>
          Recovery question
          <input value={question} onChange={(event) => setQuestion(event.target.value)} minLength={10} maxLength={160} required disabled={busy} />
        </label>
        <label>
          Private answer
          <input value={answer} onChange={(event) => setAnswer(event.target.value)} type="password" autoComplete="off" minLength={10} maxLength={128} required disabled={busy} placeholder="At least 10 characters" />
        </label>
        <p className="w-field-hint">Use an answer only you know. Answers ignore letter case and extra spaces at the ends.</p>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button className="primary" disabled={busy}>{busy ? "Saving…" : configured ? "Update recovery question" : "Set recovery question"}</button>
      </form>
    </section>
  );
}
