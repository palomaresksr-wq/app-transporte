import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { updatePassword } from "../auth/auth-service";
import { confirmInitialPasswordChange } from "../data/user-management-repository";

export function ChangePasswordPage() {
  const { access, refreshAccess } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    if (password.length < 12) return setError("La contraseña debe tener al menos 12 caracteres.");
    setBusy(true);
    try { await updatePassword(password); await confirmInitialPasswordChange(access?.organization?.id); await refreshAccess(); navigate("/", { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cambiar la contraseña."); }
    finally { setBusy(false); }
  }
  return <main className="center-page"><form className="panel compact-panel" onSubmit={submit}><span className="eyebrow">Primer acceso</span><h1>Crea tu contraseña personal</h1><p>Debes cambiar la contraseña inicial antes de continuar.</p>{error && <p role="alert" className="error-banner">{error}</p>}<label>Nueva contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label>Confirmar contraseña<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" /></label><button className="button" disabled={busy}>{busy ? "Guardando…" : "Cambiar contraseña"}</button></form></main>;
}
