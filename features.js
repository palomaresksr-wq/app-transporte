const FEATURE_DEFAULTS = {
  dashboard: true,
  estadosEntrega: true,
  facturacionPdf: true,
  exportarCsv: true,
  tiemposEspera: true,
  firmaDigital: false,
  fotoObligatoria: false,
  entregasRecurrentes: false,
  controlMargenes: false,
  rankingClientes: false,
  portalCliente: false,
  envioEmail: false,
  notificaciones: false,
  geolocalizacion: false
};

const FEATURE_LABELS = {
  dashboard: "Dashboard",
  estadosEntrega: "Estados de entrega",
  facturacionPdf: "Facturación PDF",
  exportarCsv: "Exportar CSV",
  tiemposEspera: "Tiempos de espera",
  firmaDigital: "Firma digital",
  fotoObligatoria: "Foto obligatoria",
  entregasRecurrentes: "Entregas recurrentes",
  controlMargenes: "Control de márgenes",
  rankingClientes: "Ranking de clientes",
  portalCliente: "Portal cliente",
  envioEmail: "Envío por email",
  notificaciones: "Notificaciones",
  geolocalizacion: "Geolocalización"
};

function getFeatures() {
  try {
    const saved = JSON.parse(localStorage.getItem("app_features")) || {};
    return { ...FEATURE_DEFAULTS, ...saved };
  } catch (e) {
    return { ...FEATURE_DEFAULTS };
  }
}

function saveFeatures(features) {
  localStorage.setItem("app_features", JSON.stringify(features));
}

function isFeatureEnabled(name) {
  const features = getFeatures();
  return !!features[name];
}
