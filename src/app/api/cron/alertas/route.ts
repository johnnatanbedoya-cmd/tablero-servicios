import { Resend } from "resend";
import { recolectarTodo } from "@/lib/recolectar";
import { diasHasta } from "@/lib/semaforo";
import type { Medidor } from "@/lib/tipos";

export const maxDuration = 60;

const PREFIJO_ASUNTO = "🔴 Tablero de servicios";
const NO_REPETIR_DIAS = 7;

/**
 * Lo llama el cron de Vercel una vez al día (vercel.json). Solo manda correo
 * si hay algo en rojo, y si el mismo conjunto de alertas ya se avisó en los
 * últimos 7 días no lo repite. El asunto lleva los ids de lo que está en
 * rojo, así que un rojo nuevo sí dispara correo de inmediato.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const rojos = (await recolectarTodo()).filter((m) => m.estado === "rojo");
  if (rojos.length === 0) return Response.json({ enviado: false, motivo: "Nada en rojo" });

  const { RESEND_API_KEY: claveResend, ALERTA_PARA: para, ALERTA_DE: de } = process.env;
  if (!claveResend || !para || !de) {
    return Response.json({ error: "Faltan RESEND_API_KEY, ALERTA_PARA o ALERTA_DE" }, { status: 500 });
  }

  const asunto = `${PREFIJO_ASUNTO}: ${rojos.length} en rojo [${rojos.map((m) => m.id).sort().join(", ")}]`.slice(0, 300);
  const resend = new Resend(claveResend);

  if (await yaSeAviso(resend, asunto)) {
    return Response.json({ enviado: false, motivo: `Ya se avisó lo mismo en los últimos ${NO_REPETIR_DIAS} días` });
  }

  const url = process.env.TABLERO_URL;
  const { error } = await resend.emails.send({
    from: de,
    to: para.split(",").map((s) => s.trim()),
    subject: asunto,
    html: cuerpoCorreo(rojos, url),
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ enviado: true, rojos: rojos.length });
}

/**
 * Usa el historial de envíos de Resend como memoria (el tablero no tiene
 * base de datos). Si no se puede consultar, prefiere avisar de más.
 */
async function yaSeAviso(resend: Resend, asunto: string): Promise<boolean> {
  try {
    const { data } = await resend.emails.list();
    const desde = Date.now() - NO_REPETIR_DIAS * 24 * 60 * 60 * 1000;
    return (data?.data ?? []).some((e) => e.subject === asunto && new Date(e.created_at).getTime() >= desde);
  } catch {
    return false;
  }
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function detalle(m: Medidor): string {
  if (m.vence) return `Vence en ${diasHasta(m.vence)} días`;
  if (m.usado !== undefined && m.limite) {
    const pct = Math.round((m.usado / m.limite) * 100);
    return m.unidad ? `${m.usado.toFixed(1)} de ${m.limite} ${m.unidad} (${pct}%)` : (m.nota ?? "");
  }
  return m.nota ?? "";
}

function cuerpoCorreo(rojos: Medidor[], url?: string): string {
  const filas = rojos
    .map(
      (m) => `<tr>
  <td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapar(m.servicio)}</strong><br>${escapar(m.nombre)}</td>
  <td style="padding:8px;border-bottom:1px solid #eee">${escapar(detalle(m))}${m.apps?.length ? `<br><small>Afecta: ${escapar(m.apps.join(", "))}</small>` : ""}</td>
</tr>`
    )
    .join("");
  return `<div style="font-family:Arial,sans-serif;color:#1b1f24">
<p>Hay ${rojos.length} servicio(s) en rojo:</p>
<table style="border-collapse:collapse;width:100%">${filas}</table>
${url ? `<p><a href="${escapar(url)}">Abrir el tablero</a></p>` : ""}
<p style="color:#888;font-size:12px">No se repetirá este mismo aviso en ${NO_REPETIR_DIAS} días; si algo más se pone en rojo, llegará un correo nuevo.</p>
</div>`;
}
