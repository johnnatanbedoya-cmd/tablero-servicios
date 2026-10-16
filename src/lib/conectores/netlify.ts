import { APPS_POR_SITIO_NETLIFY } from "@/config/servicios";
import { falta, mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

const API = "https://api.netlify.com/api/v1";

interface Sitio {
  id: string;
  name: string;
  admin_url?: string;
}

interface Deploy {
  state?: string;
  created_at?: string;
  error_message?: string | null;
}

/**
 * Los equipos de Netlify en planes "por créditos" no exponen el consumo por
 * API (solo en el panel), así que los créditos son un dato manual en
 * src/config/servicios.ts. Lo que sí se lee acá: si el último despliegue a
 * producción de cada sitio falló (= la app no se actualizó).
 */
export async function leerNetlify(): Promise<MedidorSinEstado[]> {
  const token = process.env.NETLIFY_TOKEN;
  if (!token) {
    return [{ id: "netlify", servicio: "Netlify", nombre: "Alojamiento", error: falta("NETLIFY_TOKEN"), enlace: "https://app.netlify.com" }];
  }
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const sitios = await pedirJson<Sitio[]>(`${API}/sites?filter=all&per_page=100`, { headers });
    return Promise.all(sitios.map((s) => leerSitio(s, headers)));
  } catch (e) {
    return [{ id: "netlify", servicio: "Netlify", nombre: "Alojamiento", error: mensajeError(e), enlace: "https://app.netlify.com" }];
  }
}

async function leerSitio(s: Sitio, headers: HeadersInit): Promise<MedidorSinEstado> {
  const base = {
    id: `netlify-${s.id}-despliegue`,
    servicio: "Netlify",
    nombre: `${s.name} · último despliegue`,
    apps: APPS_POR_SITIO_NETLIFY[s.name] ?? [],
    enlace: s.admin_url ? `${s.admin_url}/deploys` : "https://app.netlify.com",
  };
  try {
    const [d] = await pedirJson<Deploy[]>(`${API}/sites/${s.id}/deploys?production=true&per_page=1`, { headers });
    if (!d) return { ...base, error: "Sin despliegues todavía" };
    const fallo = d.state === "error";
    const cuando = d.created_at
      ? new Date(d.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })
      : "";
    return {
      ...base,
      // 0/1 para reusar el semáforo: 1 de 1 = rojo.
      usado: fallo ? 1 : 0,
      limite: 1,
      unidad: "",
      nota: `${fallo ? `Falló${d.error_message ? `: ${d.error_message}` : ""}` : "OK"} (${d.state ?? "?"}) · ${cuando}`,
    };
  } catch (e) {
    return { ...base, error: mensajeError(e) };
  }
}
