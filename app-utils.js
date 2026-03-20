function getEntregas() {
  try {
    return JSON.parse(localStorage.getItem("entregas")) || [];
  } catch (e) {
    return [];
  }
}

function saveEntregas(entregas) {
  localStorage.setItem("entregas", JSON.stringify(entregas));
}

function getClientes() {
  try {
    return JSON.parse(localStorage.getItem("clientes")) || [];
  } catch (e) {
    return [];
  }
}

function saveClientes(clientes) {
  localStorage.setItem("clientes", JSON.stringify(clientes));
}

function formatEuros(valor) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(Number(valor || 0));
}

function hoyISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function mesActual() {
  return hoyISO().slice(0, 7);
}

function generarId() {
  return "id_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}
