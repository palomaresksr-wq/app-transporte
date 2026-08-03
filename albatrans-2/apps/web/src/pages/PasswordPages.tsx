import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  requestPasswordReset,
  updatePassword
} from "../auth/auth-service";

export function RequestPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setMessage(
        "Si existe una cuenta con ese correo, recibirá las instrucciones."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar.");
    }
  }

  return (
    <SimpleAuthPanel title="Recuperar contraseña">
      <form onSubmit={submit}>
        <label htmlFor="reset-email">Correo electrónico</label>
        <input
          id="reset-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {message ? <p className="success-message">{message}</p> : null}
        {error ? <p className="error-message">{error}</p> : null}
        <button className="button" type="submit">Enviar instrucciones</button>
      </form>
      <Link className="text-link" to="/login">Volver al acceso</Link>
    </SimpleAuthPanel>
  );
}

export function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 10) {
      setMessage("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    try {
      await updatePassword(password);
      setMessage("Contraseña actualizada. Ya puedes volver a Albatrans.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "No se pudo actualizar."
      );
    }
  }

  return (
    <SimpleAuthPanel title="Nueva contraseña">
      <form onSubmit={submit}>
        <label htmlFor="new-password">Nueva contraseña</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <label htmlFor="new-password-confirmation">Repetir contraseña</label>
        <input
          id="new-password-confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        {message ? <p className="notice">{message}</p> : null}
        <button className="button" type="submit">Guardar contraseña</button>
      </form>
      <Link className="text-link" to="/login">Volver al acceso</Link>
    </SimpleAuthPanel>
  );
}

function SimpleAuthPanel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="center-page">
      <section className="panel auth-panel">
        <p className="eyebrow">Albatrans 2.0</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
