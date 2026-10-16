import { DATOS_MANUALES } from "@/config/servicios";
import { leerAnthropic } from "@/lib/conectores/anthropic";
import { leerDominios } from "@/lib/conectores/dominios";
import { leerGithub } from "@/lib/conectores/github";
import { leerNeon } from "@/lib/conectores/neon";
import { leerNetlify } from "@/lib/conectores/netlify";
import { leerVercel } from "@/lib/conectores/vercel";
import { mensajeError } from "@/lib/http";
import { conEstado, ordenarPorGravedad } from "@/lib/semaforo";
import type { Medidor, MedidorSinEstado } from "@/lib/tipos";

function leerManuales(): MedidorSinEstado[] {
  return DATOS_MANUALES.map((d) => ({
    id: d.id,
    servicio: d.servicio,
    nombre: d.nombre,
    apps: d.apps,
    usado: d.usado,
    limite: d.limite,
    unidad: d.unidad,
    vence: d.vence,
    nota: d.nota,
    enlace: d.enlace,
    manual: d.actualizado ? { actualizado: d.actualizado } : undefined,
    error: d.usado === undefined && !d.vence ? "Dato manual pendiente (src/config/servicios.ts)" : undefined,
  }));
}

const CONECTORES: [string, () => Promise<MedidorSinEstado[]>][] = [
  ["Neon", leerNeon],
  ["Netlify", leerNetlify],
  ["Vercel", leerVercel],
  ["GitHub", leerGithub],
  ["Anthropic", leerAnthropic],
  ["Dominios", leerDominios],
];

export async function recolectarTodo(): Promise<Medidor[]> {
  const ahora = new Date();
  const resultados = await Promise.all(
    CONECTORES.map(async ([servicio, leer]) => {
      try {
        return await leer();
      } catch (e) {
        // Red de seguridad: cada conector ya captura sus errores, pero un
        // fallo inesperado tampoco debe tumbar el tablero.
        return [{ id: servicio.toLowerCase(), servicio, nombre: servicio, error: mensajeError(e) }];
      }
    })
  );
  return ordenarPorGravedad([...resultados.flat(), ...leerManuales()].map((m) => conEstado(m, ahora)));
}
