# Navegación móvil tipo app (barra inferior + PWA)

Objetivo: en móvil, barra de navegación inferior para todos los usuarios y sitio instalable. Rama `feat/navegacion-movil-app` (desde `main`). Entrega: un commit por tarea, estrategia `ask-on-risk`. Pruebas: Vitest (`npm test`) y Playwright (`npm run test:e2e`). Plan completo: `C:\Users\edgar\.claude\plans\shiny-dreaming-lollipop.md`.

## Specs

- S1: "Debe mostrarse en la pagina de todos los usuarios la barra inferior." — barra fija abajo en móvil (< `md`) en la parte pública, en `/auth`, en `/panel` y en `/admin`. En escritorio no cambia nada.
- S2: más de 5 ítems → los 4 primeros más "Más" (hoja con el resto y el enlace a la otra área). La barra pública no lee la sesión (ítems fijos).
- S3: "Podemos hacer que el diseño en movil se vea como si fuera una app para telefonos moviles?" — sitio instalable (manifest, íconos, `viewport`/`themeColor`, `appleWebApp`), sin service worker.
- S4: sin regresiones: los e2e existentes de Panel/Salir siguen pasando en móvil y escritorio; colores solo por tokens; textos en voseo (D30).

## Tasks

| ID | Tarea | Specs | Ruta | Estado | Commit |
|----|-------|-------|------|--------|--------|
| T1 | Lógica pura: `splitBottomNav`, `publicNavigation`, íconos, `resolveArea` | S1, S2 | inline | hecho (RED 10 fallos → GREEN 19/19) | 48324cd |
| T2 | Componente `BottomNav` | S1, S2 | inline | hecho (typecheck, lint y ui-guards; la prueba de comportamiento es el e2e de T7) | ver `git log` |
| T3 | Integración en `AppShell` (incluye zona segura superior de la cabecera) | S1, S2, S4 | inline | hecho (typecheck, lint; e2e en T7) | ver `git log` |
| T4 | Integración en `(public)` y `auth` (con `Suspense` + `BottomNavFallback`) | S1, S2 | inline | hecho (build OK, `/` sigue estática; el primer build falló en `/[slug]` por `usePathname` sin Suspense) | ver `git log` |
| T5 | `viewport`, `themeColor`, `appleWebApp`, zonas seguras (las de cabeceras y pie ya entraron en T3/T4) | S3 | inline | hecho (typecheck, lint, ui-guards; API verificada en `node_modules/next/dist/docs`) | ver `git log` |
| T6 | Manifest e íconos (`manifest.ts`, `apple-icon.tsx`, route handler estático `/pwa-icon/[size]` en vez de `icon.tsx`, para tener URLs fijas en el manifest) | S3 | inline | hecho (build OK, todo estático; PNG verificados y el 512 revisado a ojo) | ver `git log` |
| T7 | e2e móvil + D33 + CLAUDE.md | S1-S4 | inline | hecho (spec nuevo 13/13; suite completa 86 OK + 1 regresión de selector en `team.spec.ts`, corregida y 12/12) | ver `git log` |

## Log

- L1 (2026-11-03): "Podemos hacer que el diseño en movil se vea como si fuera una app para telefonos moviles?" → "Debe mostrarse en la pagina de todos los usuarios la barra inferior. Hagamos el plan para que lo ejecute sonnet 5.5" → "Ejecuta el plan"
- L3 (2026-11-03): verificación final. Vitest 423/423 (41 archivos); typecheck limpio; lint con los 2 avisos de antes (`planes/page.tsx`, `suscripcion/page.tsx`, `Link` sin uso); build OK con `/` estática. e2e: `mobile-nav.spec.ts` 13 pasan y 7 se saltan a propósito (casos solo móvil o solo escritorio). La suite completa dio 86 OK y 1 fallo: `team.spec.ts` "an anonymous visitor…" en móvil, porque la barra pública sumó un segundo enlace "Ingresar" (modo estricto); se acotó a `main` y `team.spec.ts` quedó 12/12. No se volvió a correr la suite completa después de ese único cambio de selector.
- L2: D32 vive en la rama `docs/d32-piloto-base-dev` (sin push); esta rama sale de `main`, por eso la decisión nueva se numera D33.
