# 01 — Producto y reglas de negocio

## Producto

SaaS para que propietarios de cabañas, casas, departamentos, habitaciones y pequeños hoteles administren sus alojamientos y reservas desde el celular. La plataforma cobra una suscripción mensual a cada propietario.

| Perfil | Qué hace |
|---|---|
| **Superadmin** (titular de la plataforma) | Aprueba propietarios, define planes, registra cobros de suscripciones, suspende y reactiva, ve todo con auditoría |
| **Propietario** (organización) | Administra establecimientos, unidades, tarifas, reservas, huéspedes y pagos; invita colaboradores |
| **Colaborador** | Rol fijo dentro de una organización: `admin` u `operator` |
| **Visitante** | Ve la página pública, consulta disponibilidad y escribe por WhatsApp. No tiene cuenta |

### Roles de la organización

| Acción | owner | admin | operator |
|---|:-:|:-:|:-:|
| Ver calendario, reservas, huéspedes | ✓ | ✓ | ✓ |
| Crear/editar reservas, bloqueos, check-in/out | ✓ | ✓ | ✓ |
| Registrar pagos de huéspedes | ✓ | ✓ | ✓ |
| Anular pagos, devoluciones | ✓ | ✓ | — |
| Tarifas, establecimientos, unidades, fotos | ✓ | ✓ | — |
| Colaboradores, datos de la organización | ✓ | — | — |
| Ver suscripción y pagos de la plataforma | ✓ | — | — |

## Alcance del MVP núcleo

1. Registro de propietario → selección de plan → **aprobación del Superadmin** → prueba gratuita de 7 días.
2. Planes y suscripciones con **cobro manual**: el Superadmin registra el pago. Facturación por aniversario, días de gracia, descuentos personalizados, suspensión y reactivación.
3. Estructura Organización → Establecimientos → Categorías (opcional) → Unidades, con fotos, comodidades y ubicación.
4. Calendario mensual y semanal, reservas provisionales y confirmadas, bloqueos manuales, check-in y check-out, intervalo de limpieza.
5. Tarifas: base, temporadas, fines de semana, feriados, fechas especiales, precio por huésped adicional (opcional), estadía mínima, descuento por duración. Moneda ARS.
6. Pagos de huéspedes registrados a mano (seña, pagos parciales, saldo) en efectivo, transferencia, Mercado Pago u otro medio. **Sin pasarela online.**
7. Base de huéspedes con historial de reservas y consentimiento de comunicaciones guardado (para usarlo en v1.1).
8. Página pública por establecimiento: fotos, descripción, ubicación, servicios, unidades, calendario de disponibilidad, tarifas publicables, botón de WhatsApp y SEO básico.
9. Auditoría de acciones sensibles.

**v1.1:** CRM y promociones, AdSense, gastos y reportes, centro de notificaciones, API de WhatsApp.

## Reglas de reservas

- **Origen:** las reservas las registra el equipo del propietario. La página pública **no crea reservas**: muestra disponibilidad y deriva a WhatsApp. Las fechas se bloquean recién cuando el propietario registra la reserva, provisional o confirmada.
- **Estados de reserva:** `provisional` → `confirmed` → `checked_in` → `checked_out`. También pueden pasar a `cancelled`, y una provisional que no se confirma pasa a `expired`. Bloquean disponibilidad: `provisional` (mientras no vence), `confirmed`, `checked_in` y `checked_out`. No bloquean: `cancelled` y `expired`.
- **Bloqueos manuales** (mantenimiento, uso propio): son registros `kind = block` en la misma tabla y bloquean igual que una reserva.
- **Fechas:** se usa `check_in` y `check_out` como DATE local del establecimiento. La salida es exclusiva: una estadía del 10 al 13 ocupa las noches 10, 11 y 12. `check_out` siempre es posterior a `check_in`.
- **Provisional:** vence a las N horas, configurable por establecimiento entre 6 y 12. El vencimiento se registra en `expires_at`. Al vencer pasa a `expired` y libera las fechas.
- **Limpieza:** `cleaning_buffer_days`, por establecimiento, agrega noches bloqueadas después de la salida. Con 0, otro huésped puede entrar el mismo día que sale el anterior. Se copia en cada reserva al crearla.
- **Hoteles:** cada habitación es una unidad física. Si se reserva por categoría, el sistema asigna automáticamente la primera unidad libre. El propietario puede reasignarla después, siempre que no se superponga con otra reserva.
- **Capacidad:** la cantidad de huéspedes no puede superar `max_guests` de la unidad.

## Reglas de tarifas

- El precio se calcula **noche por noche**. Para cada noche se aplica la regla vigente de **mayor prioridad**. Las prioridades por defecto, de menor a mayor, son: base 0, temporada 10, fin de semana 20, feriado 30, fecha especial 40. Cada regla puede tener una prioridad explícita. Si dos reglas tienen la misma prioridad, se usa la creada más recientemente.
- Fin de semana = las noches de los días configurados (por defecto, viernes y sábado).
- Huéspedes adicionales: se suma un cargo por noche por cada huésped que supere los incluidos en la tarifa, si la regla lo define.
- Estadía mínima: se exige la mayor `min_nights` entre las reglas aplicadas en la estadía.
- Descuento por duración: se aplica el mayor porcentaje cuyo `min_nights` se cumpla, sobre el subtotal.
- Seña sugerida: un porcentaje configurable por establecimiento. El propietario puede ajustarla en cada reserva.
- Al crear o confirmar la reserva, el servidor calcula y **congela** el total, el desglose por noche, las reglas aplicadas y la seña. Cambiar una tarifa después no modifica las reservas existentes.

## Reglas de suscripciones

- Estados: `trial` (7 días) → `active` → `past_due` (vencida, dentro de los días de gracia) → `suspended`. También existe `cancelled`.
- Período mensual **por aniversario**, contado desde la fecha de activación.
- Al registrar un pago, el período se extiende y una cuenta suspendida se reactiva.
- Con la cuenta suspendida, el panel queda en solo lectura y la página pública muestra "no disponible". Los datos no se borran.
- Descuento personalizado por organización: porcentaje o monto, con fecha de vencimiento opcional.

## Parámetros pendientes de decisión comercial

No se inventan valores: precio y límites de cada plan (unidades, colaboradores), días de gracia iniciales, dominio, nombre comercial, proveedor de correo (SMTP) y política de conservación de datos.
