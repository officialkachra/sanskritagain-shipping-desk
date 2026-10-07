"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function Login() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="login">
      <h1>Shipping Desk</h1>
      <p className="muted">SanskritAgain dispatch, demo mode. Synthetic orders only.</p>
      <fieldset>
        <legend>Sign in as</legend>
        <label className="radio"><input type="radio" name="role" value="ADMIN" defaultChecked /> Admin — approves and books</label>
        <label className="radio"><input type="radio" name="role" value="PACKER" /> Packer — packs and holds</label>
      </fieldset>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
