"use client";
import type { FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import KopiLogo from "./kopi-logo";
import "./login-screen.css";
export default function LoginScreen({onSubmit,onSignup,busy,loading,error}:{onSubmit:(e:FormEvent<HTMLFormElement>)=>void;onSignup:()=>void;busy:boolean;loading:boolean;error:string}) {
  return <main className="login-screen"><section className="login-panel" aria-labelledby="login-title">
    <a href="/" className="brand login-brand" aria-label="Kopi home"><KopiLogo/>Kopi<span className="brand-dot">.</span></a>
    <h1 id="login-title">Welcome back.</h1>
    <p>Sign in to your Kopi account.</p>
    {loading ? <p role="status">Checking your session…</p> : <form onSubmit={onSubmit}>
      <label htmlFor="login-email">Email</label>
      <input id="login-email" name="email" type="email" autoComplete="username" required autoCapitalize="none" placeholder="you@example.com" disabled={busy}/>
      <label htmlFor="login-password">Password</label>
      <input id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="Your password" disabled={busy}/>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={18}/></button>
    </form>}
    {!loading && <button type="button" className="text-button login-signup" disabled={busy} onClick={onSignup}>New to Kopi? Create an account</button>}
  </section></main>;
}
