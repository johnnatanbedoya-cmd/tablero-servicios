import { GITHUB_MINUTOS_INCLUIDOS, GITHUB_REPOS_CI, GITHUB_USUARIO } from "@/config/servicios";
import { falta, mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

const API = "https://api.github.com";
const MINUTO_MS = 60_000;

interface Ejecucion {
  id: number;
}

interface Trabajo {
  started_at?: string | null;
  completed_at?: string | null;
}

/**
 * Minutos de GitHub Actions del mes en los repos privados con CI.
 *
 * Primero intenta el dato oficial de facturación (token con permiso de
 * cuenta "Plan: Read-only"). Si el token no lo tiene, lo calcula sumando la
 * duración de cada trabajo del mes, redondeada al minuto como cobra GitHub
 * (token con acceso a esos repos y "Actions: Read-only").
 */
export async function leerGithub(): Promise<MedidorSinEstado[]> {
  const base = {
    id: "github-actions",
    servicio: "GitHub",
    nombre: "Minutos de Actions",
    apps: ["Batería RP (CI)"],
    enlace: "https://github.com/settings/billing/usage",
  };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [{ ...base, error: falta("GITHUB_TOKEN") }];

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const ahora = new Date();
  const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));

  const medidor = (usado: number, nota?: string): MedidorSinEstado[] => [
    {
      ...base,
      usado,
      limite: GITHUB_MINUTOS_INCLUIDOS,
      unidad: "min",
      periodoInicio: inicio.toISOString(),
      periodoFin: fin.toISOString(),
      nota,
    },
  ];

  try {
    const { minutos, pagado } = await minutosFacturados(ahora, headers);
    return medidor(minutos, pagado > 0 ? `Ya hay cobro este mes: US$${pagado.toFixed(2)}` : undefined);
  } catch (errorFacturacion) {
    try {
      const porRepo = await Promise.all(GITHUB_REPOS_CI.map((repo) => minutosDelRepo(repo, inicio, headers)));
      return medidor(porRepo.reduce((s, m) => s + m, 0), "Calculado sumando los trabajos del mes.");
    } catch {
      return [{ ...base, error: mensajeError(errorFacturacion) }];
    }
  }
}

interface ItemUso {
  product?: string;
  unitType?: string;
  quantity?: number;
  netAmount?: number;
}

/** Dato oficial de facturación: necesita el permiso de cuenta "Plan: Read-only". */
async function minutosFacturados(ahora: Date, headers: HeadersInit): Promise<{ minutos: number; pagado: number }> {
  const { usageItems = [] } = await pedirJson<{ usageItems?: ItemUso[] }>(
    `${API}/users/${GITHUB_USUARIO}/settings/billing/usage?year=${ahora.getUTCFullYear()}&month=${ahora.getUTCMonth() + 1}`,
    { headers }
  );
  const actions = usageItems.filter((i) => i.product?.toLowerCase() === "actions");
  return {
    minutos: actions.filter((i) => i.unitType?.toLowerCase() === "minutes").reduce((s, i) => s + (i.quantity ?? 0), 0),
    pagado: actions.reduce((s, i) => s + (i.netAmount ?? 0), 0),
  };
}

async function minutosDelRepo(repo: string, desde: Date, headers: HeadersInit): Promise<number> {
  const raiz = `${API}/repos/${GITHUB_USUARIO}/${repo}/actions/runs`;
  const fecha = desde.toISOString().slice(0, 10);

  const ejecuciones: Ejecucion[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const { workflow_runs } = await pedirJson<{ workflow_runs: Ejecucion[] }>(
      `${raiz}?created=>=${fecha}&per_page=100&page=${pagina}`,
      { headers }
    );
    ejecuciones.push(...workflow_runs);
    if (workflow_runs.length < 100) break;
  }

  const minutos = await Promise.all(
    ejecuciones.map(async (e) => {
      const { jobs } = await pedirJson<{ jobs: Trabajo[] }>(`${raiz}/${e.id}/jobs?per_page=100`, { headers });
      return jobs.reduce((s, j) => {
        if (!j.started_at || !j.completed_at) return s;
        const ms = new Date(j.completed_at).getTime() - new Date(j.started_at).getTime();
        // GitHub cobra cada trabajo redondeado hacia arriba al minuto.
        return s + Math.max(1, Math.ceil(ms / MINUTO_MS));
      }, 0);
    })
  );
  return minutos.reduce((s, m) => s + m, 0);
}
