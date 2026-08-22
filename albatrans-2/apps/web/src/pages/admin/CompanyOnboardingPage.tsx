import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  loadOnboarding,
  saveOnboarding,
} from "../../data/onboarding-repository";

const STEPS = [
  "Datos de empresa",
  "Configuración operativa",
  "Primer vehículo",
  "Primer conductor",
  "Primer cliente",
  "POD y documentos",
  "Facturación opcional",
];

export function CompanyOnboardingPage() {
  const { access, refreshAccess, signOut } = useAuth();
  const navigate = useNavigate();
  const organizationId = access?.organization?.id;
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    if (!organizationId) return;
    loadOnboarding(organizationId).then((state) => {
      setStep(state.currentStep);
      setCompleted(state.completedSteps);
    }).catch((cause: unknown) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar el onboarding.",
      )
    ).finally(() => setBusy(false));
  }, [organizationId]);
  async function advance(skip = false) {
    if (!organizationId) return;
    setBusy(true);
    setError("");
    const nextCompleted = skip
      ? completed
      : Array.from(new Set([...completed, step])).sort((a, b) => a - b);
    const final = step === STEPS.length;
    try {
      await saveOnboarding(
        organizationId,
        final ? STEPS.length : step + 1,
        nextCompleted,
        final,
      );
      if (final) {
        await refreshAccess();
        navigate("/empresa", { replace: true });
      } else {
        setCompleted(nextCompleted);
        setStep(step + 1);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar el progreso.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function goBack() {
    if (!organizationId || step <= 1) return;
    const previous = step - 1;
    setBusy(true);
    try {
      await saveOnboarding(organizationId, previous, completed);
      setStep(previous);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar el progreso.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function continueLater() {
    if (!organizationId) return;
    setBusy(true);
    try {
      await saveOnboarding(organizationId, step, completed);
      await signOut();
      navigate("/login", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar el progreso.",
      );
      setBusy(false);
    }
  }
  if (!organizationId) {
    return (
      <main className="center-page">
        <p role="alert">Empresa no disponible.</p>
      </main>
    );
  }
  return (
    <main className="center-page">
      <section
        className="panel compact-panel"
        aria-labelledby="onboarding-title"
      >
        <span className="eyebrow">
          Primeros pasos · {step} de {STEPS.length}
        </span>
        <h1 id="onboarding-title">{STEPS[step - 1]}</h1>
        <p>
          Configura esta sección desde Administración. Tu progreso se guarda y
          no tendrás que repetir los pasos completados.
        </p>
        <progress
          value={step}
          max={STEPS.length}
          aria-label="Progreso del onboarding"
        />
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="form-actions">
          {step > 1 && <button className="button button-secondary" disabled={busy} onClick={() => void goBack()}>Atrás</button>}
          <button
            className="button"
            disabled={busy}
            onClick={() => void advance(false)}
          >
            {step === STEPS.length
              ? "Finalizar onboarding"
              : "Marcar listo y continuar"}
          </button>
          {step > 2 && (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => void advance(true)}
            >
              Saltar por ahora
            </button>
          )}
          <button className="button button-secondary" disabled={busy} onClick={() => void continueLater()}>Continuar más tarde</button>
        </div>
      </section>
    </main>
  );
}
