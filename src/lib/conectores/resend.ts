import { Resend } from "resend";
import { RESEND_LIMITES } from "@/config/servicios";
import { falta, mensajeError } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

const MAX_PAGINAS = 40;
// Resend permite 2 peticiones por segundo.
const PAUSA_MS = 550;

/**
 * Cuenta los correos enviados en el mes y en el día (UTC) recorriendo el
 * historial de Resend, del más nuevo al más viejo, hasta salir del mes.
 * Necesita una clave con acceso completo: las de solo envío no pueden
 * listar.
 */
export async function leerResend(): Promise<MedidorSinEstado[]> {
  const base = { servicio: "Resend", apps: ["OGP", "Agenda Psicológica"], enlace: "https://resend.com/emails" };
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return [{ ...base, id: "resend-correos-mes", nombre: "Correos enviados este mes", error: falta("RESEND_API_KEY") }];

  const ahora = new Date();
  const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  const finMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
  const inicioDia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));

  try {
    const resend = new Resend(clave);
    let mes = 0;
    let dia = 0;
    let despues: string | undefined;
    let completo = false;

    for (let pagina = 0; pagina < MAX_PAGINAS && !completo; pagina++) {
      if (pagina > 0) await new Promise((r) => setTimeout(r, PAUSA_MS));
      const { data, error } = await resend.emails.list(despues ? { limit: 100, after: despues } : { limit: 100 });
      if (error) throw new Error(error.message);

      for (const correo of data?.data ?? []) {
        const creado = new Date(correo.created_at);
        if (creado < inicioMes) {
          completo = true;
          break;
        }
        mes++;
        if (creado >= inicioDia) dia++;
      }
      const ultimo = data?.data.at(-1);
      if (!data?.has_more || !ultimo) completo = true;
      despues = ultimo?.id;
    }

    return [
      {
        ...base,
        id: "resend-correos-mes",
        nombre: "Correos enviados este mes",
        usado: mes,
        limite: RESEND_LIMITES.porMes,
        unidad: "correos",
        periodoInicio: inicioMes.toISOString(),
        periodoFin: finMes.toISOString(),
        nota: completo ? undefined : "Conteo parcial: hay más correos de los que se alcanzaron a revisar.",
      },
      {
        ...base,
        id: "resend-correos-dia",
        nombre: "Correos enviados hoy (UTC)",
        usado: dia,
        limite: RESEND_LIMITES.porDia,
        unidad: "correos",
      },
    ];
  } catch (e) {
    return [{ ...base, id: "resend-correos-mes", nombre: "Correos enviados este mes", error: mensajeError(e) }];
  }
}
