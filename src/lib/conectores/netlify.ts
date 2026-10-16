import { APPS_POR_EQUIPO_NETLIFY } from "@/config/servicios";
import { falta, mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

const API = "https://api.netlify.com/api/v1";
const GB = 1024 ** 3;

interface CuentaNetlify {
  id: string;
  slug: string;
  name: string;
  type_name?: string;
}

/**
 * Netlify no documenta oficialmente un endpoint de consumo. Estos dos
 * (ancho de banda y minutos de build) son los que su propio panel usa y los
 * que su equipo de soporte recomienda en el foro; en los planes nuevos "por
 * créditos" pueden no responder, y entonces la fila sale en gris con el
 * enlace al panel.
 */
export async function leerNetlify(): Promise<MedidorSinEstado[]> {
  const token = process.env.NETLIFY_TOKEN;
  if (!token) {
    return [{ id: "netlify", servicio: "Netlify", nombre: "Alojamiento", error: falta("NETLIFY_TOKEN"), enlace: "https://app.netlify.com" }];
  }
  const headers = { Authorization: `Bearer ${token}` };

  let cuentas: CuentaNetlify[];
  try {
    cuentas = await pedirJson<CuentaNetlify[]>(`${API}/accounts`, { headers });
  } catch (e) {
    return [{ id: "netlify", servicio: "Netlify", nombre: "Alojamiento", error: mensajeError(e), enlace: "https://app.netlify.com" }];
  }

  const filas = await Promise.all(cuentas.map((c) => leerCuenta(c, headers)));
  return filas.flat();
}

function appsDe(c: CuentaNetlify): string[] {
  const clave = Object.keys(APPS_POR_EQUIPO_NETLIFY).find(
    (k) => k.toLowerCase() === c.slug.toLowerCase() || k.toLowerCase() === c.name.toLowerCase()
  );
  return clave ? APPS_POR_EQUIPO_NETLIFY[clave] : [];
}

async function leerCuenta(c: CuentaNetlify, headers: HeadersInit): Promise<MedidorSinEstado[]> {
  const enlace = `https://app.netlify.com/teams/${c.slug}/usage`;
  const base = { servicio: "Netlify", apps: appsDe(c), enlace };
  const equipo = `Equipo ${c.name}${c.type_name ? ` (${c.type_name})` : ""}`;

  const [ancho, builds] = await Promise.allSettled([
    pedirJson<{ used?: number; included?: number; period_start_date?: string; period_end_date?: string }>(
      `${API}/accounts/${c.slug}/bandwidth`,
      { headers }
    ),
    pedirJson<{
      minutes?: { current?: number; included_minutes?: number; period_start_date?: string; period_end_date?: string };
    }>(`${API}/${c.slug}/builds/status`, { headers }),
  ]);

  const filas: MedidorSinEstado[] = [];

  if (ancho.status === "fulfilled" && ancho.value.included) {
    const a = ancho.value;
    filas.push({
      ...base,
      id: `netlify-${c.id}-ancho`,
      nombre: `${equipo} · ancho de banda`,
      usado: (a.used ?? 0) / GB,
      limite: a.included! / GB,
      unidad: "GB",
      periodoInicio: a.period_start_date,
      periodoFin: a.period_end_date,
    });
  } else {
    filas.push({
      ...base,
      id: `netlify-${c.id}-ancho`,
      nombre: `${equipo} · ancho de banda`,
      error: ancho.status === "rejected" ? mensajeError(ancho.reason) : "Netlify no informó el límite (¿plan por créditos?). Revísalo en el panel.",
    });
  }

  const m = builds.status === "fulfilled" ? builds.value.minutes : undefined;
  if (m?.included_minutes) {
    filas.push({
      ...base,
      id: `netlify-${c.id}-build`,
      nombre: `${equipo} · minutos de build`,
      usado: m.current ?? 0,
      limite: m.included_minutes,
      unidad: "min",
      periodoInicio: m.period_start_date,
      periodoFin: m.period_end_date,
    });
  } else {
    filas.push({
      ...base,
      id: `netlify-${c.id}-build`,
      nombre: `${equipo} · minutos de build`,
      error: builds.status === "rejected" ? mensajeError(builds.reason) : "Netlify no informó el límite (¿plan por créditos?). Revísalo en el panel.",
    });
  }

  return filas;
}
