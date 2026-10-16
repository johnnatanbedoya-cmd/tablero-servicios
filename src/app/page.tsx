import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { salir } from "@/app/acciones";
import { recolectarTodo } from "@/lib/recolectar";
import { diasHasta } from "@/lib/semaforo";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";
import type { Estado, Medidor } from "@/lib/tipos";

const COLOR: Record<Estado, string> = {
  rojo: "var(--rojo)",
  amarillo: "var(--amarillo)",
  verde: "var(--verde)",
  "sin-dato": "var(--gris)",
};

const ETIQUETA: Record<Estado, string> = {
  rojo: "En rojo",
  amarillo: "Atención",
  verde: "Bien",
  "sin-dato": "Sin dato",
};

function numero(n: number, unidad?: string): string {
  const decimales = n === 0 || n >= 100 ? 0 : n >= 10 ? 1 : 2;
  const texto = n.toLocaleString("es-CO", { maximumFractionDigits: decimales });
  if (unidad === "USD") return `US$${texto}`;
  return unidad ? `${texto} ${unidad}` : texto;
}

function fecha(iso: string, timeZone = "America/Bogota"): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone });
}

function Tarjeta({ m }: { m: Medidor }) {
  const color = COLOR[m.estado];
  const tieneBarra = m.usado !== undefined && !!m.limite && m.unidad !== "";
  const pct = tieneBarra ? (m.usado! / m.limite!) * 100 : 0;

  return (
    <li className="rounded-xl border border-borde bg-tarjeta p-4" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-suave">{m.servicio}</p>
          <h3 className="font-semibold leading-snug">{m.nombre}</h3>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          {ETIQUETA[m.estado]}
        </span>
      </div>

      {m.vence && (
        <p className="mt-2 text-sm">
          Vence el <strong>{fecha(m.vence)}</strong> · faltan <strong>{diasHasta(m.vence)} días</strong>
        </p>
      )}

      {tieneBarra && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <strong>{numero(m.usado!, m.unidad)}</strong> <span className="text-suave">de {numero(m.limite!, m.unidad)}</span>
            </span>
            <span className="font-semibold tabular-nums" style={{ color }}>
              {Math.round(pct)}%
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-pista" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
          </div>
          {m.proyeccion !== undefined && (
            <p className="mt-1.5 text-xs text-suave">
              Al ritmo actual cerraría el periodo en ~{numero(m.proyeccion, m.unidad)}
              {m.proyeccion > m.limite! && <strong style={{ color: "var(--rojo)" }}> (se pasa del límite)</strong>}
              {/* Los periodos cierran a medianoche UTC: en hora Colombia saldría el día anterior. */}
              {m.periodoFin && <> · se reinicia el {fecha(m.periodoFin, "UTC")}</>}
            </p>
          )}
        </div>
      )}

      {m.error && <p className="mt-2 text-sm text-suave">{m.error}</p>}
      {m.nota && <p className="mt-2 text-xs text-suave">{m.nota}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {m.apps?.map((app) => (
          <span key={app} className="rounded-md bg-pista px-2 py-0.5">
            {app}
          </span>
        ))}
        {m.manual && <span className="text-suave">Dato manual del {fecha(m.manual.actualizado)}</span>}
        {m.enlace && (
          <a href={m.enlace} target="_blank" rel="noreferrer" className="ml-auto font-medium underline underline-offset-2">
            Abrir panel
          </a>
        )}
      </div>
    </li>
  );
}

export default async function Tablero() {
  // El proxy ya protege la ruta; esto es la segunda línea de defensa.
  if (!(await sesionValida((await cookies()).get(COOKIE_SESION)?.value))) redirect("/login");

  const medidores = await recolectarTodo();
  const conteo = (e: Estado) => medidores.filter((m) => m.estado === e).length;
  const hora = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tablero de servicios</h1>
          <p className="text-sm text-suave">Actualizado {hora}</p>
        </div>
        <form action={salir}>
          <button className="rounded-lg border border-borde px-3 py-1.5 text-sm">Salir</button>
        </form>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["rojo", "amarillo", "verde", "sin-dato"] as Estado[]).map((e) => (
          <div key={e} className="rounded-xl border border-borde bg-tarjeta p-3">
            <p className="text-3xl font-bold tabular-nums" style={{ color: COLOR[e] }}>
              {conteo(e)}
            </p>
            <p className="text-sm text-suave">{ETIQUETA[e]}</p>
          </div>
        ))}
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        {medidores.map((m) => (
          <Tarjeta key={m.id} m={m} />
        ))}
      </ul>

      <p className="mt-8 text-xs text-suave">
        Amarillo desde el 70% del límite o si al ritmo actual se pasaría antes de que cierre el periodo; rojo desde el 90%. Dominios: amarillo a 60 días del
        vencimiento, rojo a 30. Solo llega correo cuando algo está en rojo.
      </p>
    </main>
  );
}
