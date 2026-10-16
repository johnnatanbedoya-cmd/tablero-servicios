import { GITHUB_MINUTOS_INCLUIDOS, GITHUB_USUARIO } from "@/config/servicios";
import { falta, mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

interface ItemUso {
  product?: string;
  unitType?: string;
  quantity?: number;
  netAmount?: number;
}

/**
 * Minutos de GitHub Actions del mes (los repos públicos no consumen).
 * Usa el endpoint nuevo de facturación y, si la cuenta aún no lo tiene, el
 * antiguo /settings/billing/actions.
 */
export async function leerGithub(): Promise<MedidorSinEstado[]> {
  const enlace = "https://github.com/settings/billing/usage";
  const base = { id: "github-actions", servicio: "GitHub", nombre: "Minutos de Actions", apps: ["Batería RP (CI)"], enlace };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [{ ...base, error: falta("GITHUB_TOKEN") }];

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const ahora = new Date();
  const periodoInicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString();
  const periodoFin = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1)).toISOString();

  try {
    const { usageItems = [] } = await pedirJson<{ usageItems?: ItemUso[] }>(
      `https://api.github.com/users/${GITHUB_USUARIO}/settings/billing/usage?year=${ahora.getUTCFullYear()}&month=${ahora.getUTCMonth() + 1}`,
      { headers }
    );
    const actions = usageItems.filter((i) => i.product?.toLowerCase() === "actions");
    const minutos = actions.filter((i) => i.unitType?.toLowerCase() === "minutes").reduce((s, i) => s + (i.quantity ?? 0), 0);
    const pagado = actions.reduce((s, i) => s + (i.netAmount ?? 0), 0);
    return [
      {
        ...base,
        usado: minutos,
        limite: GITHUB_MINUTOS_INCLUIDOS,
        unidad: "min",
        periodoInicio,
        periodoFin,
        nota: pagado > 0 ? `Ya hay cobro este mes: US$${pagado.toFixed(2)}` : undefined,
      },
    ];
  } catch (errorNuevo) {
    try {
      const v = await pedirJson<{ total_minutes_used?: number; included_minutes?: number }>(
        `https://api.github.com/users/${GITHUB_USUARIO}/settings/billing/actions`,
        { headers }
      );
      return [
        {
          ...base,
          usado: v.total_minutes_used ?? 0,
          limite: v.included_minutes || GITHUB_MINUTOS_INCLUIDOS,
          unidad: "min",
          periodoInicio,
          periodoFin,
        },
      ];
    } catch {
      return [{ ...base, error: mensajeError(errorNuevo) }];
    }
  }
}
