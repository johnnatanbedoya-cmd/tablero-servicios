import { mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

interface PaginaCostos {
  data: { results: { amount: string; currency: string }[] }[];
  has_more: boolean;
  next_page?: string | null;
}

/**
 * Gasto del mes en la API de Claude vía el Cost Report del Admin API. Solo
 * funciona con una clave Admin (sk-ant-admin...), que Anthropic no da a
 * cuentas individuales: sin ella esta fila no aparece y queda el dato
 * manual de src/config/servicios.ts.
 *
 * ANTHROPIC_PRESUPUESTO_USD es el tope mensual contra el que se compara.
 */
export async function leerAnthropic(): Promise<MedidorSinEstado[]> {
  const clave = process.env.ANTHROPIC_ADMIN_KEY;
  if (!clave) return [];

  const ahora = new Date();
  const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
  const base = {
    id: "anthropic-gasto-mes",
    servicio: "Anthropic",
    nombre: "Gasto del mes en la API",
    apps: ["OGP", "RP-Reader"],
    enlace: "https://platform.claude.com/cost",
  };

  try {
    let centavos = 0;
    let pagina: string | undefined;
    do {
      const params = new URLSearchParams({
        starting_at: inicio.toISOString(),
        ending_at: new Date(Math.min(fin.getTime(), ahora.getTime() + 86_400_000)).toISOString(),
        limit: "31",
      });
      if (pagina) params.set("page", pagina);
      const r = await pedirJson<PaginaCostos>(`https://api.anthropic.com/v1/organizations/cost_report?${params}`, {
        headers: { "x-api-key": clave, "anthropic-version": "2023-06-01" },
      });
      // `amount` viene en centavos de dólar, como texto decimal.
      for (const cubeta of r.data) for (const res of cubeta.results) centavos += Number(res.amount) || 0;
      pagina = r.has_more && r.next_page ? r.next_page : undefined;
    } while (pagina);

    const presupuesto = Number(process.env.ANTHROPIC_PRESUPUESTO_USD) || undefined;
    return [
      {
        ...base,
        usado: centavos / 100,
        limite: presupuesto,
        unidad: "USD",
        periodoInicio: inicio.toISOString(),
        periodoFin: fin.toISOString(),
        error: presupuesto ? undefined : "Define ANTHROPIC_PRESUPUESTO_USD para tener semáforo",
      },
    ];
  } catch (e) {
    return [{ ...base, error: mensajeError(e) }];
  }
}
