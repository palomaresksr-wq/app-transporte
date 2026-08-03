import { effectiveRoleHome } from "@albatrans/domain";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { signIn } from "../auth/auth-service";

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!auth.configured) return <Navigate to="/configuracion" replace />;
  if (auth.access) {
    return <Navigate to={effectiveRoleHome(auth.access.effectiveRole)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "No se pudo iniciar sesión."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const state = location.state as { from?: string } | null;

  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <span className="brand-mark">A</span>
        <p className="eyebrow">Albatrans 2.0</p>
        <h1>La operativa de transporte, ordenada y segura.</h1>
        <p>
          Acceso seguro por rol y empresa mediante Supabase Auth. Albatrans 1
          continúa sin cambios.
        </p>
      </section>

      <section className="panel auth-panel">
        <p className="eyebrow">Acceso</p>
        <h2>Entrar en Albatrans</h2>
        <p className="muted">Usa la cuenta creada mediante Supabase Auth.</p>

        {state?.from ? (
          <p className="notice">Inicia sesión para continuar.</p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {message ? <p className="error-message">{message}</p> : null}

          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Comprobando…" : "Entrar"}
          </button>
        </form>

        <Link className="text-link" to="/recuperar-contrasena">
          He olvidado mi contraseña
        </Link>
      </section>
    </main>
  );
}
