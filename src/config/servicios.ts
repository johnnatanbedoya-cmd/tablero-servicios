// Lo que no se puede leer por API (o que se quiere fijar a mano) vive acá.
// Para actualizar un dato manual: cambia `usado` y `actualizado`, haz commit
// y push; Vercel republica solo.

/** Endpoint de Neon (el "ep-..." del DATABASE_URL) → apps que lo usan. */
export const APPS_POR_ENDPOINT_NEON: Record<string, string[]> = {
  "ep-fragrant-pond-b456mt4g": ["OGP"],
  "ep-sweet-sunset-aev8mtwk": ["Batería RP"],
  "ep-square-snow-b515lgru": ["Agenda Psicológica"],
};

/** Límites del plan gratis de Neon (por proyecto, por mes). */
export const NEON_LIMITES = {
  cuHoras: 100,
  almacenamientoGB: 1,
};

/** Sitio de Netlify (nombre) → app. */
export const APPS_POR_SITIO_NETLIFY: Record<string, string[]> = {
  "agenda-psicologica": ["Agenda Psicológica"],
};

/** Proyecto de Vercel → app. */
export const APPS_POR_PROYECTO_VERCEL: Record<string, string[]> = {
  ogp: ["OGP"],
};

export const GITHUB_USUARIO = "johnnatanbedoya-cmd";
/** Minutos de GitHub Actions incluidos en el plan gratis (repos privados). */
export const GITHUB_MINUTOS_INCLUIDOS = 2000;

export interface Dominio {
  nombre: string;
  donde: string;
  apps: string[];
}

export const DOMINIOS: Dominio[] = [
  { nombre: "rpcolomiba.com", donde: "Netlify (equipo adulto)", apps: ["Agenda Psicológica", "Correos OGP/Agenda"] },
  { nombre: "rp-colombia.com", donde: "Netlify (equipo adulto)", apps: [] },
  { nombre: "rpcolombia.com", donde: "Netlify (equipo adulto)", apps: [] },
];

export interface DatoManual {
  id: string;
  servicio: string;
  nombre: string;
  apps: string[];
  /** Déjalo sin valor mientras no tengas el dato: sale en gris. */
  usado?: number;
  limite?: number;
  unidad: string;
  /** Fecha (AAAA-MM-DD) en que escribiste `usado`. */
  actualizado?: string;
  /** Si el dato es una fecha de vencimiento en vez de un consumo. */
  vence?: string;
  nota?: string;
  enlace: string;
}

export const DATOS_MANUALES: DatoManual[] = [
  {
    id: "netlify-creditos-mes",
    servicio: "Netlify",
    nombre: "Créditos usados este mes (equipo adulto)",
    apps: ["Agenda Psicológica", "Batería RP"],
    limite: 1000,
    unidad: "créditos",
    nota: "Plan Personal: 1.000 créditos al mes. Netlify no los da por API; el dato se copia de Usage & billing.",
    enlace: "https://app.netlify.com/teams/adulto/billing/usage",
  },
  {
    id: "resend-correos-mes",
    servicio: "Resend",
    nombre: "Correos enviados este mes",
    apps: ["OGP", "Agenda Psicológica"],
    limite: 3000,
    unidad: "correos",
    nota: "Plan gratis: 3.000 al mes y 100 al día, compartidos entre las apps.",
    enlace: "https://resend.com/emails",
  },
  {
    id: "anthropic-saldo",
    servicio: "Anthropic",
    nombre: "Créditos gastados de lo recargado",
    apps: ["OGP", "RP-Reader"],
    unidad: "USD",
    nota: "Pon en `limite` lo que recargaste y en `usado` lo gastado. Si tienes clave Admin, el gasto del mes se lee solo.",
    enlace: "https://platform.claude.com/settings/billing",
  },
  {
    id: "meta-whatsapp",
    servicio: "Meta WhatsApp",
    nombre: "Gasto en mensajes este mes",
    apps: ["Agenda Psicológica"],
    unidad: "USD",
    nota: "Pon en `limite` el tope que quieras gastar al mes.",
    enlace: "https://business.facebook.com/billing_hub",
  },
];
