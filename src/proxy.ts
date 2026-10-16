import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";

// /api/cron se protege con CRON_SECRET (lo manda Vercel), no con la cookie.
const RUTAS_PUBLICAS = ["/login", "/api/cron"];

export async function proxy(request: NextRequest) {
  // Server Actions (login/salir): cada una maneja su propia cookie.
  if (request.method !== "GET") return NextResponse.next();

  const { pathname } = request.nextUrl;
  const publica = RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const ok = await sesionValida(request.cookies.get(COOKIE_SESION)?.value);

  if (!ok && !publica) return NextResponse.redirect(new URL("/login", request.url));
  if (ok && pathname === "/login") return NextResponse.redirect(new URL("/", request.url));

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
