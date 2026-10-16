import type { Estado, Medidor, MedidorSinEstado } from "./tipos";

// Umbrales de consumo (fracción del límite).
export const UMBRAL_AMARILLO = 0.7;
export const UMBRAL_ROJO = 0.9;
// Umbrales de vencimiento (días que faltan).
export const DIAS_AMARILLO = 60;
export const DIAS_ROJO = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

export function diasHasta(fechaIso: string, ahora = new Date()): number {
  return Math.floor((new Date(fechaIso).getTime() - ahora.getTime()) / DIA_MS);
}

/**
 * Uso proyectado al cierre del periodo, asumiendo que el ritmo de lo que va
 * del periodo se mantiene. Sin fechas de periodo no hay proyección.
 */
export function proyectar(
  usado: number,
  periodoInicio: string | undefined,
  periodoFin: string | undefined,
  ahora = new Date()
): number | undefined {
  if (!periodoInicio || !periodoFin) return undefined;
  const inicio = new Date(periodoInicio).getTime();
  const fin = new Date(periodoFin).getTime();
  const transcurrido = ahora.getTime() - inicio;
  // En las primeras 24h la proyección es puro ruido.
  if (!(fin > inicio) || transcurrido < DIA_MS) return undefined;
  return (usado * (fin - inicio)) / Math.min(transcurrido, fin - inicio);
}

export function calcularEstado(m: MedidorSinEstado, ahora = new Date()): Estado {
  if (m.error) return "sin-dato";

  if (m.vence) {
    const dias = diasHasta(m.vence, ahora);
    if (dias <= DIAS_ROJO) return "rojo";
    if (dias <= DIAS_AMARILLO) return "amarillo";
    return "verde";
  }

  if (m.usado === undefined || !m.limite) return "sin-dato";
  const fraccion = m.usado / m.limite;
  if (fraccion >= UMBRAL_ROJO) return "rojo";
  // Si al ritmo actual se pasa del límite antes de que cierre el periodo,
  // es amarillo aunque hoy vaya bajo: es lo que avisa con tiempo.
  const fraccionProyectada = m.proyeccion !== undefined ? m.proyeccion / m.limite : 0;
  if (fraccion >= UMBRAL_AMARILLO || fraccionProyectada >= 1) return "amarillo";
  return "verde";
}

export function conEstado(m: MedidorSinEstado, ahora = new Date()): Medidor {
  const proyeccion =
    m.proyeccion ?? (m.usado !== undefined ? proyectar(m.usado, m.periodoInicio, m.periodoFin, ahora) : undefined);
  const completo = { ...m, proyeccion };
  return { ...completo, estado: calcularEstado(completo, ahora) };
}

const ORDEN: Record<Estado, number> = { rojo: 0, amarillo: 1, "sin-dato": 2, verde: 3 };

export function ordenarPorGravedad(medidores: Medidor[]): Medidor[] {
  return [...medidores].sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);
}
