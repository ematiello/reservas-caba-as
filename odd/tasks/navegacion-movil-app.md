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
| T3 | Integración en `AppShell` | S1, S2, S4 | inline | pendiente | |
| T4 | Integración en `(public)` y `auth` | S1, S2 | inline | pendiente | |
| T5 | `viewport`, `themeColor`, `appleWebApp`, zonas seguras | S3 | inline | pendiente | |
| T6 | Manifest e íconos | S3 | inline | pendiente | |
| T7 | e2e móvil + D33 + CLAUDE.md | S1-S4 | inline | pendiente | |

## Log

- L1 (2026-11-03): "Podemos hacer que el diseño en movil se vea como si fuera una app para telefonos moviles?" → "Debe mostrarse en la pagina de todos los usuarios la barra inferior. Hagamos el plan para que lo ejecute sonnet 5.5" → "Ejecuta el plan"
- L2: D32 vive en la rama `docs/d32-piloto-base-dev` (sin push); esta rama sale de `main`, por eso la decisión nueva se numera D33.
