// Fetch con tiempo límite y error legible: un servicio caído o lento no debe
// tumbar el tablero entero, solo su propia fila.
export async function pedirJson<T>(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const texto = (await res.text().catch(() => "")).trim();
    // Una página HTML de error no le dice nada a quien mira el tablero.
    const cuerpo = texto.startsWith("<") ? "" : texto.slice(0, 200);
    throw new Error(`HTTP ${res.status}${cuerpo ? `: ${cuerpo}` : ""}`);
  }
  return (await res.json()) as T;
}

export function mensajeError(e: unknown): string {
  if (e instanceof Error) return e.name === "TimeoutError" ? "El servicio no respondió a tiempo" : e.message;
  return String(e);
}

export function falta(variable: string): string {
  return `Falta configurar ${variable} en Vercel`;
}
