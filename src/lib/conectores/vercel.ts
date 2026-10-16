import { APPS_POR_PROYECTO_VERCEL } from "@/config/servicios";
import { falta, mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

interface Despliegue {
  name: string;
  url: string;
  state?: string;
  readyState?: string;
  target?: string | null;
  created: number;
}

/**
 * Vercel no tiene API pública de consumo para el plan Hobby, así que acá se
 * vigila lo que sí se puede: si el último despliegue a producción de cada
 * proyecto quedó en error (= la app no se actualizó). El consumo se revisa
 * con el enlace al panel.
 */
export async function leerVercel(): Promise<MedidorSinEstado[]> {
  const token = process.env.TOKEN_VERCEL;
  if (!token) {
    return [{ id: "vercel", servicio: "Vercel", nombre: "Alojamiento", error: falta("TOKEN_VERCEL"), enlace: "https://vercel.com/dashboard" }];
  }

  try {
    const { deployments } = await pedirJson<{ deployments: Despliegue[] }>(
      "https://api.vercel.com/v6/deployments?limit=50&target=production",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // La API los devuelve del más nuevo al más viejo: el primero de cada
    // proyecto es el último despliegue.
    const ultimos = new Map<string, Despliegue>();
    for (const d of deployments) if (!ultimos.has(d.name)) ultimos.set(d.name, d);

    return [...ultimos.values()].map((d) => {
      const estado = d.readyState ?? d.state ?? "DESCONOCIDO";
      const fallo = estado === "ERROR" || estado === "CANCELED";
      return {
        id: `vercel-${d.name}-despliegue`,
        servicio: "Vercel",
        nombre: `${d.name} · último despliegue`,
        apps: APPS_POR_PROYECTO_VERCEL[d.name] ?? [],
        // Se expresa como 0/1 para reusar el semáforo: 1 de 1 = rojo.
        usado: fallo ? 1 : 0,
        limite: 1,
        unidad: "",
        nota: `${fallo ? "Falló" : "OK"} (${estado}) · ${new Date(d.created).toLocaleString("es-CO", { timeZone: "America/Bogota" })}. Consumo del plan: ver panel.`,
        enlace: `https://vercel.com/dashboard/usage`,
      };
    });
  } catch (e) {
    return [{ id: "vercel", servicio: "Vercel", nombre: "Alojamiento", error: mensajeError(e), enlace: "https://vercel.com/dashboard" }];
  }
}
