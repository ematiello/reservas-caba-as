# 06 — Pendientes técnicos

Seguimientos que dejaron las revisiones de las fases 1 a 3. Ninguno bloquea; se revisan uno por uno. Al resolver uno, anotar el commit en la columna Estado. Las decisiones comerciales pendientes siguen en `05-decisiones.md`.

| # | Fase | Dónde | Pendiente | Estado |
|---|------|-------|-----------|--------|
| P1 | 1 | `loginAction` | Todo error de inicio de sesión se muestra como "Email o contraseña incorrectos", también el límite de tasa de Supabase (429). Falta un mensaje propio. | Abierto |
| P2 | 1 | `completePendingRegistration` | Devuelve `slug_taken` / `error` y quien lo llama lo ignora: el usuario no se entera (revisión B, R3-002). | Abierto |
| P3 | 1 | `removeMemberAction`, `changeMemberRoleAction` | Ignoran el error de la base (revisión C, R3-001). | Abierto |
| P4 | 1 | `/auth/confirm` | Consume el token en un GET: un escáner de enlaces del correo podría gastarlo (revisión B, R3-004). | Abierto |
| P5 | 1 | Despliegue | Fijar `NEXT_PUBLIC_SITE_URL` en producción para no depender del header `Host` (R1-002 de B y C). | Abierto |
| P6 | 1 | Manual | Probar el registro real por email (depende del SMTP, ver `05`). | Abierto |
| P7 | 3 | Bucket `media` | Es público: las fotos de un establecimiento en borrador se ven con la URL exacta (lleva UUID). | Abierto |
| P8 | 3 | Borrado de establecimiento | No borra sus archivos de Storage (unidades y fotos sí). | Abierto |
| P9 | 3 | `deleteUnitAction`, `deleteMediaAction` | Ignoran el error de `storage.remove`: pueden quedar archivos huérfanos sin aviso. | Abierto |
| P10 | 3 | Subida de fotos | Si `registerMediaAction` rechaza un archivo ya subido, el archivo queda huérfano en Storage; `uploadPhotos` descarta el detalle del error. | Abierto |
| P11 | 3 | `publicMediaUrl` | Sin `NEXT_PUBLIC_SUPABASE_URL` arma `undefined/storage/...` en silencio. | Abierto |
| P12 | 3 | `registerMediaAction` | El orden (`sort`) se calcula con un conteo previo: dos subidas simultáneas pueden repetirlo. | Abierto |
| P13 | 3 | `createUnitAction` | Detecta el tope de unidades buscando el texto "unit limit reached" en el mensaje; conviene un código de error propio. | Abierto |
| P14 | 3 | `updateUnitAction` | Filtra por organización y unidad, no por establecimiento (no filtra datos, pero es inconsistente con las demás acciones). | Abierto |
| P15 | 3 | `properties.timezone` | No se valida como zona IANA (hoy la UI no lo edita). | Abierto |
| P16 | 3 | Uploader | `crypto.randomUUID()` solo existe en contextos seguros: falla por HTTP en una IP de la red local. | Abierto |
| P17 | 3 | Pruebas e2e | El servidor standalone a veces termina con código 127 sin dejar log, también con `node` directo. | Abierto |
| P18 | 1-3 | UI | Decidir el registro del español de la interfaz (hoy voseo: "Revisá", "Elegí") y si los formularios usan React Hook Form (hoy solo server actions + Zod; ver L7 de la Fase 1). | Abierto |
| P19 | 1-3 | Engram | El espejo en Engram de las bitácoras `odd/tasks` está pendiente: no hubo herramientas de Engram en estas sesiones. | Abierto |
