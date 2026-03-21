import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://jpnritlcfumjmdpoaytr.supabase.co";
export const SUPABASE_ANON_KEY ="sb_publishable_6CF_v2_aPe5d3faZfQxAuw_f4epFsYr" ;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const MODULE_LABELS = {
  entregas: "Entregas",
  facturacion: "Facturación",
  fichajes: "Fichajes",
  vacaciones: "Vacaciones",
  clientes: "Clientes",
  vehiculos: "Vehículos",
  conductores: "Conductores",
  dashboard: "Dashboard",
  ocr: "OCR albaranes",
  firma_digital: "Firma digital",
  geolocalizacion: "Geolocalización",
  portal_cliente: "Portal cliente"
};

const SESSION_KEY = "albatrans_session_v2";

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES");
  } catch {
    return dateStr;
  }
}

export async function loginApp(usuario, password) {
  const { data, error } = await supabase
    .from("usuarios_app")
    .select(`
      id,
      nombre,
      usuario,
      rol,
      activo,
      empresa_id,
      empresas:empresa_id (
        id,
        nombre,
        slug,
        activa,
        color_primario,
        logo_url
      )
    `)
    .eq("usuario", usuario)
    .eq("password", password)
    .eq("activo", true)
    .limit(1);

  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row) throw new Error("Usuario o contraseña incorrectos");

  if (row.rol !== "superadmin") {
    if (!row.empresas?.activa) {
      throw new Error("La empresa está desactivada");
    }

    const { data: modules, error: modulesError } = await supabase
      .from("modulos_empresa")
      .select("*")
      .eq("empresa_id", row.empresa_id)
      .single();

    if (modulesError) throw new Error(modulesError.message);

    const session = {
      user_id: row.id,
      username: row.usuario,
      nombre: row.nombre,
      rol: row.rol,
      empresa_id: row.empresa_id,
      empresa_nombre: row.empresas?.nombre || "",
      empresa_slug: row.empresas?.slug || "",
      empresa_color: row.empresas?.color_primario || "#ff7a18",
      empresa_logo: row.empresas?.logo_url || "",
      modulos: modules || {}
    };

    saveSession(session);
    return session;
  }

  const session = {
    user_id: row.id,
    username: row.usuario,
    nombre: row.nombre,
    rol: row.rol,
    empresa_id: null,
    empresa_nombre: "",
    empresa_slug: "",
    empresa_color: "#ff7a18",
    empresa_logo: "",
    modulos: null
  };

  saveSession(session);
  return session;
}

export function requireRole(roles = []) {
  const session = getSession();
  if (!session || !roles.includes(session.rol)) {
    window.location.replace("login-v2.html");
    return null;
  }
  return session;
}

export function logoutApp() {
  clearSession();
  window.location.replace("login-v2.html");
}

export async function getCompanies() {
  const { data, error } = await supabase
    .from("empresas")
    .select(`
      *,
      modulos_empresa (*),
      usuarios_app (id, nombre, usuario, rol, activo)
    `)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createCompany(payload) {
  const cleanSlug = (payload.slug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: company, error } = await supabase
    .from("empresas")
    .insert({
      slug: cleanSlug,
      nombre: payload.nombre,
      razon_social: payload.razon_social || null,
      cif: payload.cif || null,
      email: payload.email || null,
      telefono: payload.telefono || null,
      direccion: payload.direccion || null,
      color_primario: payload.color_primario || "#ff7a18",
      logo_url: payload.logo_url || null,
      activa: true
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { error: moduleError } = await supabase
    .from("modulos_empresa")
    .insert({ empresa_id: company.id });

  if (moduleError) throw new Error(moduleError.message);

  return company;
}

export async function updateCompanyModules(empresaId, modules) {
  const { error } = await supabase
    .from("modulos_empresa")
    .update(modules)
    .eq("empresa_id", empresaId);

  if (error) throw new Error(error.message);
}

export async function toggleCompanyStatus(empresaId, activa) {
  const { error } = await supabase
    .from("empresas")
    .update({ activa })
    .eq("id", empresaId);

  if (error) throw new Error(error.message);
}

export async function createAdminForCompany({ empresa_id, nombre, usuario, password }) {
  const { data, error } = await supabase
    .from("usuarios_app")
    .insert({
      empresa_id,
      nombre,
      usuario,
      password,
      rol: "admin",
      activo: true
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
