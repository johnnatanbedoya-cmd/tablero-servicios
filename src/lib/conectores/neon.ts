import { APPS_POR_ENDPOINT_NEON, NEON_LIMITES } from "@/config/servicios";
import { falta, mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

const API = "https://console.neon.tech/api/v2";
const GB = 1024 ** 3;

interface ProyectoNeon {
  id: string;
  name: string;
  compute_time_seconds?: number;
  synthetic_storage_size?: number;
  consumption_period_start?: string;
  consumption_period_end?: string;
}

/**
 * Lee consumo por proyecto desde GET /projects/{id}. Los endpoints de
 * consumption_history son solo de planes pagos, pero el detalle del proyecto
 * trae el tiempo de cómputo del periodo actual en cualquier plan.
 *
 * NEON_API_KEY admite varias claves separadas por coma, por si los
 * proyectos están en cuentas distintas.
 */
export async function leerNeon(): Promise<MedidorSinEstado[]> {
  const claves = (process.env.NEON_API_KEY ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  if (claves.length === 0) {
    return [{ id: "neon", servicio: "Neon", nombre: "Bases de datos", error: falta("NEON_API_KEY"), enlace: "https://console.neon.tech" }];
  }

  const resultados = await Promise.all(claves.map((clave, i) => leerCuenta(clave, i)));
  return resultados.flat();
}

async function leerCuenta(clave: string, indice: number): Promise<MedidorSinEstado[]> {
  const headers = { Authorization: `Bearer ${clave}`, Accept: "application/json" };
  try {
    const proyectos = await listarProyectos(headers);
    const filas = await Promise.all(proyectos.map((p) => leerProyecto(p.id, headers)));
    return filas.flat();
  } catch (e) {
    return [
      {
        id: `neon-cuenta-${indice}`,
        servicio: "Neon",
        nombre: `Cuenta ${indice + 1}`,
        error: mensajeError(e),
        enlace: "https://console.neon.tech",
      },
    ];
  }
}

/** Proyectos personales + los de cada organización a la que pertenece la clave. */
async function listarProyectos(headers: HeadersInit): Promise<{ id: string }[]> {
  const vistos = new Map<string, { id: string }>();
  const agregar = (lista: { projects?: { id: string }[] }) => lista.projects?.forEach((p) => vistos.set(p.id, p));

  const [personales, orgs] = await Promise.allSettled([
    pedirJson<{ projects?: { id: string }[] }>(`${API}/projects?limit=100`, { headers }),
    pedirJson<{ organizations?: { id: string }[] }>(`${API}/users/me/organizations`, { headers }),
  ]);
  if (personales.status === "fulfilled") agregar(personales.value);

  if (orgs.status === "fulfilled") {
    for (const org of orgs.value.organizations ?? []) {
      agregar(await pedirJson(`${API}/projects?limit=100&org_id=${encodeURIComponent(org.id)}`, { headers }));
    }
  }

  if (vistos.size === 0) {
    if (personales.status === "rejected") throw personales.reason;
    throw new Error("La clave no ve ningún proyecto");
  }
  return [...vistos.values()];
}

async function leerProyecto(id: string, headers: HeadersInit): Promise<MedidorSinEstado[]> {
  const [{ project: p }, endpoints] = await Promise.all([
    pedirJson<{ project: ProyectoNeon }>(`${API}/projects/${id}`, { headers }),
    pedirJson<{ endpoints?: { id: string }[] }>(`${API}/projects/${id}/endpoints`, { headers }).catch(() => ({ endpoints: [] })),
  ]);

  const apps = [...new Set((endpoints.endpoints ?? []).flatMap((ep) => APPS_POR_ENDPOINT_NEON[ep.id] ?? []))];
  const enlace = `https://console.neon.tech/app/projects/${p.id}`;
  const base = { servicio: "Neon", apps, enlace, periodoInicio: p.consumption_period_start, periodoFin: p.consumption_period_end };

  const filas: MedidorSinEstado[] = [
    {
      ...base,
      id: `neon-${p.id}-computo`,
      nombre: `${p.name} · cómputo`,
      usado: (p.compute_time_seconds ?? 0) / 3600,
      limite: NEON_LIMITES.cuHoras,
      unidad: "CU-h",
      nota: "Si llega al límite, Neon suspende la base hasta el siguiente periodo y la app se cae.",
    },
  ];

  if (p.synthetic_storage_size !== undefined) {
    filas.push({
      ...base,
      // El almacenamiento no se reinicia con el periodo: no tiene proyección.
      periodoInicio: undefined,
      periodoFin: undefined,
      id: `neon-${p.id}-almacenamiento`,
      nombre: `${p.name} · almacenamiento`,
      usado: p.synthetic_storage_size / GB,
      limite: NEON_LIMITES.almacenamientoGB,
      unidad: "GB",
    });
  }
  return filas;
}
