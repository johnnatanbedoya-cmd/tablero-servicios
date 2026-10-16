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
 * El endpoint de facturación de cuentas personales exige un permiso
 * ("Plan") que GitHub no ofrece a todas las cuentas en los tokens nuevos,
 * así que se calcula sumando la duración de cada trabajo del mes, redondeada
 * al minuto como cobra GitHub. Basta un token fine-grained con acceso a esos
 * repos y permiso "Actions: Read-only".
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

  try {
    const porRepo = await Promise.all(GITHUB_REPOS_CI.map((repo) => minutosDelRepo(repo, inicio, headers)));
    return [
      {
        ...base,
        usado: porRepo.reduce((s, m) => s + m, 0),
        limite: GITHUB_MINUTOS_INCLUIDOS,
        unidad: "min",
        periodoInicio: inicio.toISOString(),
        periodoFin: fin.toISOString(),
      },
    ];
  } catch (e) {
    return [{ ...base, error: mensajeError(e) }];
  }
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
