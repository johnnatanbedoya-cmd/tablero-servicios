"use client";

import { useActionState } from "react";
import { entrar } from "@/app/acciones";

export default function LoginPage() {
  const [error, accion, enviando] = useActionState(entrar, null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={accion} className="w-full max-w-sm rounded-2xl border border-borde bg-tarjeta p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex flex-col gap-1" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-rojo" />
            <span className="h-2.5 w-2.5 rounded-full bg-amarillo" />
            <span className="h-2.5 w-2.5 rounded-full bg-verde" />
          </span>
          <h1 className="text-lg font-semibold">Tablero de servicios</h1>
        </div>
        <label htmlFor="clave" className="mb-1 block text-sm text-suave">
          Contraseña
        </label>
        <input
          id="clave"
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="w-full rounded-lg border border-borde bg-fondo px-3 py-2.5 outline-none focus:border-texto"
        />
        {error && <p className="mt-2 text-sm text-rojo">{error}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="mt-4 w-full rounded-lg bg-texto py-2.5 font-medium text-fondo disabled:opacity-60"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
