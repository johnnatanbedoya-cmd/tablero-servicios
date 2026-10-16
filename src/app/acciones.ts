"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, OPCIONES_COOKIE, firmarSesion, mismaClave } from "@/lib/sesion";

export async function entrar(_previo: string | null, form: FormData): Promise<string | null> {
  const esperada = process.env.TABLERO_PASSWORD;
  if (!esperada) return "Falta configurar TABLERO_PASSWORD en Vercel.";

  const clave = String(form.get("clave") ?? "");
  if (!mismaClave(clave, esperada)) {
    // Frena intentos a fuerza bruta sin necesidad de base de datos.
    await new Promise((r) => setTimeout(r, 1000));
    return "Contraseña incorrecta.";
  }

  (await cookies()).set(COOKIE_SESION, await firmarSesion(), OPCIONES_COOKIE);
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/login");
}
