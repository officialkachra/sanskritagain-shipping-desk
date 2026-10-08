"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function Login() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="login">
      <div className="brandrow"><span className="mono" aria-hidden>स</span><span className="brandtxt"><b>Sanskrit Again</b><small>Shipping Desk</small></span></div>
      <p className="muted">SanskritAgain dispatch, demo mode. Synthetic orders only.</p>
      <fieldset>
        <legend>Sign in as</legend>
        <label className="radio"><input type="radio" name="role" value="ADMIN" defaultChecked /> Admin — approves and books</label>
        <label className="radio"><input type="radio" name="role" value="PACKER" /> Packer — packs, holds, prints existing labels</label>
        <label className="radio"><input type="radio" name="role" value="SUPPORT" /> Support — NDR remarks and assignment</label>
      </fieldset>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
