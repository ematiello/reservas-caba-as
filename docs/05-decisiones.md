# 05 — Registro de decisiones

Formato: fecha · decisión · motivo. Las decisiones nuevas se agregan al final, y si una cambia, se marca la anterior como reemplazada.

| # | Fecha | Decisión | Motivo |
|---|---|---|---|
| D1 | 2026-10-30 | El plan vigente es `Plan CHATGPT.docx` (SaaS multiempresa). Se eliminó `planificacion.md` (un solo complejo con Mercado Pago) | Indicación del usuario |
| D2 | 2026-10-30 | **MVP núcleo.** CRM, promociones, remarketing, AdSense, gastos y reportes, centro de notificaciones y API de WhatsApp pasan a v1.1 | Vender antes, con menos superficie de errores y feedback temprano de propietarios reales |
| D3 | 2026-10-30 | **Inventario = habitación física + categoría**, con asignación automática de una unidad libre | Un solo mecanismo anti-superposición (restricción de exclusión) para todo tipo de alojamiento; sin contadores de cupos |
| D4 | 2026-10-30 | **Base de datos de desarrollo = proyecto Supabase en la nube**, separado de producción. Migraciones con `supabase db push` y pruebas con Vitest | No hay Docker en el equipo de desarrollo |
| D5 | 2026-10-30 | **Roles fijos** `owner`, `admin` y `operator` | Políticas RLS simples y fáciles de probar; se puede ampliar después |
| D6 | 2026-10-30 | Hosting **Hostinger Business** (Node.js), con build `standalone`. Se validó en la Fase 0 sobre un sitio de prueba nuevo (D19) | Plan ya contratado (pedido 64958056) |
| D7 | 2026-10-30 | Vencimientos de provisionales y ciclo de vida de suscripciones en **`pg_cron`**, más una verificación en la función de alta | El proceso Node en hosting compartido no garantiza estar siempre activo |
| D8 | 2026-10-30 | Superadmin mediante `is_platform_admin()` dentro de las políticas RLS. La `service_role` se limita a tareas internas | Evitar saltear RLS desde la app; acceso auditable |
| D9 | 2026-10-30 | Precios con una función TypeScript sin efectos secundarios, con prioridades por defecto base < temporada < fin de semana < feriado < fecha especial. El resultado se congela en la reserva | Se puede probar sin base de datos y las reglas superpuestas no quedan ambiguas |
| D10 | 2026-10-30 | La página pública no crea reservas: muestra disponibilidad y deriva a WhatsApp. El propietario registra la reserva | Lo indica el relevamiento; además, el MVP no tiene pasarela de pago |
| D11 | 2026-10-30 | Intervalo de limpieza expresado en **días** (`cleaning_buffer_days`). La rotación en el mismo día se maneja con los horarios de check-in y check-out | Las estadías se modelan como DATE; las horas no cambian la ocupación por noche |
| D12 | 2026-10-30 | Páginas públicas en `/{slug}` dentro del dominio de la plataforma, sin dominios propios en el MVP | Evita configurar SSL y DNS por cliente en hosting compartido |
| D13 | 2026-10-30 | Se usa npm como gestor de paquetes | pnpm no está instalado |
| D14 | 2026-10-30 | `gga` revisa los commits con `CLAUDE.md` como reglas (sin un `AGENTS.md` duplicado) | Una sola fuente de reglas |
| D15 | 2026-10-30 | Se evaluó MySQL en Hostinger y **se mantiene Supabase**: plan gratuito en desarrollo y piloto, Supabase Pro con los primeros propietarios que pagan | MySQL obligaría a programar login, aislamiento entre organizaciones sin RLS, almacenamiento de archivos y tareas programadas: más trabajo y más riesgo de filtrar datos entre propietarios a cambio de ≈ US$25/mes |

| D16 | 2026-10-30 | Next.js 16.4 + React 19.3, shadcn preset `base-nova` (Base UI), Zod 4, Vitest 5, Playwright 1.64. Todas las versiones fijadas exactas | Última versión estable al iniciar; versiones fijas para builds reproducibles (regla del skill de Supabase) |
| D17 | 2026-10-30 | Se aceptan 3 avisos de severidad baja de `npm audit` (`deepmerge` dentro del CLI de `shadcn`) | Solo afecta herramientas de desarrollo y build; el "fix" sugerido es un downgrade a shadcn 1.0. Se revisa en cada actualización |
| D18 | 2026-10-30 | MCP oficial de Supabase (`mcp.supabase.com`, OAuth) a nivel proyecto, fijado al proyecto dev y en `read_only=true` | Los agentes pueden consultar esquema, logs y advisors sin poder modificar la base; los cambios quedan versionados como migraciones (D4) |
| D19 | 2026-10-30 | El despliegue de prueba va a un sitio nuevo e independiente de Hostinger, `violet-quail-122403.hostingersite.com` (dominio temporal gratuito, plan `64958056`); no se usa `darkcyan-seahorse-806320` | La app es independiente de los demás sitios del plan; se conecta un dominio propio más adelante |
| D20 | 2026-10-30 | Despliegue en Hostinger con build local y paquete precompilado (`npm run package:hostinger` → `dist/hostinger/app.tgz`), no build en el servidor ni conexión directa a GitHub | El servidor de build de Hostinger tiene glibc < 2.29 y el SWC nativo de Next no carga (verificado: `GLIBC_2.29 not found`). Verificado en `violet-quail-122403`: `/` y `/api/health` responden 200. Alternativas descartadas: webpack + SWC WASM (frágil con Tailwind v4) y VPS. Más adelante se puede automatizar el paso con GitHub Actions |
| D21 | 2026-10-31 | Los colaboradores se invitan con un **enlace de invitación** que el propietario comparte (p. ej. por WhatsApp), sin depender de SMTP. Token de un solo uso, se guarda solo su hash, vence a los 7 días | Evita bloquear la Fase 1 por el proveedor de correo (pendiente) y encaja con el uso de WhatsApp del producto |

## Pendientes (decisión comercial del usuario)

- Precio y límites de cada plan (unidades y colaboradores).
- Días de gracia iniciales.
- Dominio y nombre comercial.
- Proveedor de SMTP para Supabase Auth. Recomendación: Resend.
- Política de conservación de datos personales.
- Pasar a Supabase Pro (≈ US$25/mes) antes de producción.
