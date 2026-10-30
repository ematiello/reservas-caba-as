# 05 — Registro de decisiones

Formato: fecha · decisión · motivo. Las decisiones nuevas se agregan al final, y si una cambia, se marca la anterior como reemplazada.

| # | Fecha | Decisión | Motivo |
|---|---|---|---|
| D1 | 2026-10-30 | El plan vigente es `Plan CHATGPT.docx` (SaaS multiempresa). Se eliminó `planificacion.md` (un solo complejo con Mercado Pago) | Indicación del usuario |
| D2 | 2026-10-30 | **MVP núcleo.** CRM, promociones, remarketing, AdSense, gastos y reportes, centro de notificaciones y API de WhatsApp pasan a v1.1 | Vender antes, con menos superficie de errores y feedback temprano de propietarios reales |
| D3 | 2026-10-30 | **Inventario = habitación física + categoría**, con asignación automática de una unidad libre | Un solo mecanismo anti-superposición (restricción de exclusión) para todo tipo de alojamiento; sin contadores de cupos |
| D4 | 2026-10-30 | **Base de datos de desarrollo = proyecto Supabase en la nube**, separado de producción. Migraciones con `supabase db push` y pruebas con Vitest | No hay Docker en el equipo de desarrollo |
| D5 | 2026-10-30 | **Roles fijos** `owner`, `admin` y `operator` | Políticas RLS simples y fáciles de probar; se puede ampliar después |
| D6 | 2026-10-30 | Hosting **Hostinger Business** (Node.js), con build `standalone`. Se valida en la Fase 0 sobre el sitio de prueba existente | Plan ya contratado (pedido 64958056) |
| D7 | 2026-10-30 | Vencimientos de provisionales y ciclo de vida de suscripciones en **`pg_cron`**, más una verificación en la función de alta | El proceso Node en hosting compartido no garantiza estar siempre activo |
| D8 | 2026-10-30 | Superadmin mediante `is_platform_admin()` dentro de las políticas RLS. La `service_role` se limita a tareas internas | Evitar saltear RLS desde la app; acceso auditable |
| D9 | 2026-10-30 | Precios con una función TypeScript sin efectos secundarios, con prioridades por defecto base < temporada < fin de semana < feriado < fecha especial. El resultado se congela en la reserva | Se puede probar sin base de datos y las reglas superpuestas no quedan ambiguas |
| D10 | 2026-10-30 | La página pública no crea reservas: muestra disponibilidad y deriva a WhatsApp. El propietario registra la reserva | Lo indica el relevamiento; además, el MVP no tiene pasarela de pago |
| D11 | 2026-10-30 | Intervalo de limpieza expresado en **días** (`cleaning_buffer_days`). La rotación en el mismo día se maneja con los horarios de check-in y check-out | Las estadías se modelan como DATE; las horas no cambian la ocupación por noche |
| D12 | 2026-10-30 | Páginas públicas en `/{slug}` dentro del dominio de la plataforma, sin dominios propios en el MVP | Evita configurar SSL y DNS por cliente en hosting compartido |
| D13 | 2026-10-30 | Se usa npm como gestor de paquetes | pnpm no está instalado |
| D14 | 2026-10-30 | `gga` revisa los commits con `CLAUDE.md` como reglas (sin un `AGENTS.md` duplicado) | Una sola fuente de reglas |

## Pendientes (decisión comercial del usuario)

- Precio y límites de cada plan (unidades y colaboradores).
- Días de gracia iniciales.
- Dominio y nombre comercial.
- Proveedor de SMTP para Supabase Auth. Recomendación: Resend.
- Política de conservación de datos personales.
- Pasar a Supabase Pro (≈ US$25/mes) antes de producción.
