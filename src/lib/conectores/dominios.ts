import { DOMINIOS } from "@/config/servicios";
import { mensajeError, pedirJson } from "@/lib/http";
import type { MedidorSinEstado } from "@/lib/tipos";

interface RespuestaRdap {
  events?: { eventAction: string; eventDate: string }[];
}

// Servidor RDAP oficial de cada registro. rdap.org (el redirector genérico)
// responde 403 a peticiones que no vienen de un navegador, así que solo
// queda como respaldo para extensiones que no estén en esta lista.
const RDAP_POR_TLD: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1",
  net: "https://rdap.verisign.com/net/v1",
};

function urlRdap(dominio: string): string {
  const tld = dominio.split(".").pop()!.toLowerCase();
  return `${RDAP_POR_TLD[tld] ?? "https://rdap.org"}/domain/${dominio}`;
}

/**
 * Fecha de vencimiento de cada dominio vía RDAP (el sucesor público de
 * WHOIS): no necesita clave.
 */
export async function leerDominios(): Promise<MedidorSinEstado[]> {
  return Promise.all(
    DOMINIOS.map(async (d) => {
      const base = {
        id: `dominio-${d.nombre}`,
        servicio: "Dominios",
        nombre: d.nombre,
        apps: d.apps,
        enlace: "https://app.netlify.com/teams/adulto/dns",
      };
      try {
        const r = await pedirJson<RespuestaRdap>(urlRdap(d.nombre), {
          headers: { Accept: "application/rdap+json" },
        });
        const vence = r.events?.find((e) => e.eventAction === "expiration")?.eventDate;
        if (!vence) return { ...base, error: "El registro no informó fecha de vencimiento" };
        return { ...base, vence, nota: `${d.donde}. Revisa que la renovación automática y la tarjeta estén al día.` };
      } catch (e) {
        return { ...base, error: mensajeError(e) };
      }
    })
  );
}
