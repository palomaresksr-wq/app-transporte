export function ConfigurationPage() {
  return (
    <main className="center-page">
      <section className="panel compact-panel">
        <span className="brand-mark small">A</span>
        <p className="eyebrow">Configuración segura</p>
        <h1>Supabase está pendiente de configurar</h1>
        <p>
          Albatrans 2.0 se ha iniciado sin conectarse a ningún proyecto. Añade
          las variables públicas indicadas en <code>.env.example</code> para
          habilitar el acceso.
        </p>
        <p className="muted">
          Albatrans 1 permanece disponible y no ha sido modificado.
        </p>
      </section>
    </main>
  );
}
