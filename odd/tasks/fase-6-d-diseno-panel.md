# Fase 6 (cierre) — Ficha más rápida y diseño del panel
Objetivo: que `/{slug}` llegue a Lighthouse móvil ≥ 90 y que el panel, la administración y el ingreso usen la identidad "Reservas Traslasierra" de la página pública. Rama `feat/fase-6-d-diseno-panel` apilada sobre `feat/fase-6-c-buscador`. Entrega: `stacked-to-main`. Runner: Vitest y Playwright (móvil y escritorio).

## Specs
- S1. Usuario (L1): "Optimizar la ficha". Criterio de `docs/04` para la Fase 6: "Lighthouse móvil ≥ 90 en rendimiento, SEO y accesibilidad". Sin romper la invariante 6 (cuenta suspendida → "no disponible").
- S2. Usuario (L1): "diseñar la parte de administracion para el superadmin y los propietarios igual que la pagina publica. Le demos diseño porque ahora no tiene nada de css y se ve horrible." Alcance: `/panel/**`, `/admin/**` y `/auth/**` con la paleta, las tipografías (Montserrat y Lato) y el logo de la identidad; mobile-first; sin cambiar comportamiento ni textos funcionales.

## Tasks
- T1 (S1) Ficha: lecturas en paralelo y sin duplicar por pedido; medir con Lighthouse. Ruta: inline. Código hecho; Lighthouse pendiente.
- T2 (S2) Tema global de marca (tokens, fuentes en el layout raíz, arreglo de `--font-sans`) y nuevo `AppShell` con logo y navegación por área. Ruta: inline. HECHA.
- T3 (S2) Ajuste de páginas: selects, áreas de texto, grilla de ocupación, avisos e ingreso con la marca. Ruta: inline. HECHA.
- T4 (S1,S2) e2e completos, capturas y Lighthouse. Ruta: inline. Capturas HECHAS (escritorio y móvil); e2e y Lighthouse pendientes.

## Log
- L1 (2026-11-01, usuario): "Optimizar la ficha y diseñar la parte de administracion para el superadmin y los propietarios igual que la pagina publica. Le demos diseño porque ahora no tiene nada de css y se ve horrible."
- L2: Causa del "sin CSS": en `globals.css`, `@theme inline` define `--font-sans: var(--font-sans)` (referencia circular), así que todo lo que no es público cae en la fuente serif por defecto del navegador; además el panel usa el tema gris neutro de shadcn y una cabecera sin marca.
- L3: Mirror de Engram pendiente (herramientas de Engram no disponibles en esta sesión).
- L4 (usuario, 2026-11-02): "continua con la tarea que te pedi anteriormente y no me preguntes nada hasta que la hayas terminado."
- L5: T1: `resolve()` lee el estado en vivo y el contenido cacheado en paralelo (antes, en serie) y va envuelto en `cache()` de React, así metadatos y página comparten una sola lectura por pedido. El contenido solo se muestra si el estado es "published" (invariante 6 intacta). Antes del cambio: TTFB ~0,21 s y respuesta completa 0,64 a 2,3 s.
- L6: T2/T3: la marca pasa a ser el tema global (`:root`); `.brand` queda para el fondo arena de lo público. `AppShell` lee la sesión con `getAccess()` (cacheada) solo para mostrar las pestañas que el usuario puede abrir (Equipo y Suscripción solo para propietarios; pestañas de administración solo para superadmin); cada página sigue autorizando. Se quitaron las props `email`, `showAdminLink` y `showPanelLink`. Botones en píldora con Montserrat, entradas y selects con borde arena y foco oliva, tarjetas con sombra suave, avisos y grilla de ocupación en colores de la marca, ingreso con logo y sierras. Verificado: lint, typecheck, Vitest 290/290, capturas de 13 pantallas en escritorio y móvil con cuentas de prueba.
- L7: El sistema cortó por falta de memoria el servidor de desarrollo y la corrida de e2e (el build del e2e terminó con "build worker exited with code: 1"). Quedan pendientes: build de producción, e2e completos y Lighthouse de la ficha.
