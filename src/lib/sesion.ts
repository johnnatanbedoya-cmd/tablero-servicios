// Un solo usuario (el dueño), con contraseña en TABLERO_PASSWORD. La cookie
// dura 30 días para no tener que entrar cada vez desde el celular.
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESION = "tablero_sesion";
export const DURACION_SESION_S = 30 * 24 * 60 * 60;

export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DURACION_SESION_S,
};

function clave(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error("Falta la variable de entorno SESSION_SECRET");
  return new TextEncoder().encode(secreto);
}

export async function firmarSesion(): Promise<string> {
  return new SignJWT({ sub: "dueno" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_S}s`)
    .sign(clave());
}

export async function sesionValida(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, clave());
    return true;
  } catch {
    return false;
  }
}

/** Comparación en tiempo constante para no filtrar la contraseña por tiempos. */
export function mismaClave(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diferencia = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diferencia |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diferencia === 0;
}
