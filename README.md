# Tablero de servicios

Semáforo del consumo y los vencimientos de los servicios que usan OGP, Agenda Psicológica, Batería RP, RP-Reader y RP PDF Creator.

- **Automático:** Neon (CU-horas y almacenamiento por proyecto), Netlify (ancho de banda y minutos de build), Vercel (estado del último despliegue), GitHub Actions, gasto de Anthropic (solo con clave Admin) y vencimiento de dominios (RDAP, sin clave).
- **Manual:** lo que no tiene API se edita en `src/config/servicios.ts`.
- **Alertas:** un cron diario de Vercel (7 a. m. Colombia) envía un correo solo si algo está en rojo; no repite el mismo aviso en 7 días.

Variables: ver `.env.example`.

```bash
npm run dev
```
