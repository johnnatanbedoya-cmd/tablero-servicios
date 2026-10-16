export type Estado = "verde" | "amarillo" | "rojo" | "sin-dato";

/**
 * Una fila del tablero: algo que se consume contra un límite (CU-horas,
 * minutos, GB, dólares) o una fecha que vence (dominios).
 */
export interface Medidor {
  /** Estable entre días: se usa para no repetir el mismo correo de alerta. */
  id: string;
  servicio: string;
  nombre: string;
  /** Qué apps dependen de esto, para saber qué se cae si se agota. */
  apps?: string[];
  usado?: number;
  limite?: number;
  unidad?: string;
  /** Para dominios: fecha de vencimiento (ISO). */
  vence?: string;
  periodoInicio?: string;
  periodoFin?: string;
  /** Uso estimado al cierre del periodo si sigue al mismo ritmo. */
  proyeccion?: number;
  nota?: string;
  /** Dato escrito a mano en src/config/servicios.ts (no viene de una API). */
  manual?: { actualizado: string };
  enlace?: string;
  error?: string;
  estado: Estado;
}

export type MedidorSinEstado = Omit<Medidor, "estado">;
