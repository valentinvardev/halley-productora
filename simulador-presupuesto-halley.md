# Simulador de Presupuesto — Halley (15 Años y Bodas)

Referencia de estructura/UX: simulador de epica.pic (wizard multi-paso, progreso por dots, total fijo en footer, cards seleccionables). El diseño estético no se toma como referencia, solo la lógica de flujo y componentes.

## 1. Objetivo

Wizard interactivo donde el cliente arma su cobertura audiovisual paso a paso, ve el total actualizarse en tiempo real, y al final genera un presupuesto con código de seguimiento, opción de pago/reserva y contacto directo por WhatsApp.

## 2. Alcance

Solo dos tipos de evento: **15 Años** y **Bodas**. No incluye egresos ni otros eventos (a diferencia de la referencia, que sí los tenía).

## 3. Flujo general (wizard)

Patrón de la referencia a mantener: header con back/forward, barra de progreso (dots), contenido central, footer sticky con "Ver detalles" + Total + botón Continuar + link Volver.

### Paso 0 — Selección de evento
- Mi Boda / Mi Quince (cards grandes, selección única, avanza automático al elegir)

### Paso 1 — Parte 1: Book / Sesión base
*(selección única — tipo radio, como "Sesiones Disponibles" en la referencia)*

**Para 15s:**
- Book Pre 15s, con sub-opción de locación:
  - Estudio
  - Espacios abiertos privados
  - Sierras o altas cumbres
- Preparativos previos
- Cobertura fiesta

**Para Bodas:** estructura equivalente a definir con el cliente (no vino detallada en su mensaje — ver sección 6).

*Nota UX: el "Book Pre 15s" tiene un nivel extra de selección (la locación) que no existe en los otros dos ítems de este paso — evaluar si se resuelve con un sub-selector que aparece solo si se elige esa opción, o con 3 cards independientes dentro del mismo paso.*

### Paso 2 — Parte 2: Coberturas
*(selección múltiple, checkboxes, cada uno suma $ al total — como "Coberturas Disponibles" en la referencia)*
- Fotografía
- Video y dron para exterior
- Contenido para redes

### Paso 3 — Parte 3: Complementos
*("Que tu fiesta no le falte nada" — multi-select, mismo patrón que "Complementarios Disponibles")*
- Segundo Fotógrafo
- Invitación digital
- Drone acrobático para interiores
- Edición en vivo de video
- Video para ingreso al salón
- Entrega de fotografía impresa en vivo
- Fotolibro de 10 páginas 30x45

### Paso 4 — Datos de contacto
- Nombre
- Celular
- Correo electrónico
- Toggle: "Enviame copia del presupuesto por correo y novedades por WhatsApp"

### Paso 5 — Datos del evento
- Selector de fecha (calendario mensual)
- Texto aclaratorio: "Si aún no tenés confirmado el salón o la fecha, elegí una fecha aproximada"

### Paso 6 — Reserva y forma de pago
- Reserva (obligatoria): monto fijo que congela el precio y reserva la fecha, se descuenta del total
- Saldo restante — opciones:
  - Pago único (10% de descuento)
  - 3 cuotas (sin interés) — "más elegido"
  - 6 cuotas (sin interés)
  - 9 cuotas (+30% interés)

### Paso 7 — Confirmación
- Mensaje de éxito: "Presupuesto generado con éxito. Ya podés abonar la reserva."
- Código de seguimiento copiable (formato sugerido: `Q-[APELLIDO]-[AÑO]-[HASH]` / `B-[APELLIDO]-[AÑO]-[HASH]` según tipo de evento)
- Resumen visual tipo "tarjeta de presupuesto" con nombre del evento, reserva, saldo restante
- Acciones: Contactar por WhatsApp (mensaje prellenado con el código), Descargar presupuesto (PDF), Reeditar

## 4. Halley Box (gamificación)

A medida que se suman contrataciones, se desbloquea o se va revelando la Halley Box: caja sorpresa con regalos de la productora y de empresas aliadas.

Puntos a definir con el cliente:
- Criterio de desbloqueo: ¿por cantidad de ítems contratados, por monto mínimo acumulado, o está siempre incluida y solo se "revela" como incentivo visual a medida que se avanza?
- Dónde mostrarla en el flujo: ¿barra de progreso persistente en el footer ("Te faltan $X para tu Halley Box"), o un paso/mensaje dedicado que aparece al cruzar el umbral?
- Si conviene mantener el contenido de la caja oculto (efecto sorpresa) mostrando solo un teaser genérico.

## 5. Modelo de datos / lógica de precios (a definir con el cliente)

Cada ítem seleccionable necesita: `id`, `nombre`, `descripción`, `precio`, `categoría` (book / cobertura / complemento), `aplica_a` (15s / boda / ambos).

- Total = suma de ítems seleccionados en los 3 pasos de armado.
- Reserva = a definir si es % del total o monto fijo (en la referencia se ve un caso donde la reserva ($50.050) es mayor al total de ítems elegidos ($42.900) — revisar si incluye algo adicional tipo seña mínima o cargo fijo).

## 6. Preguntas abiertas para el cliente

- Estructura exacta del "Book" para Bodas (equivalente a Estudio / Espacios abiertos / Sierras de 15s)
- Precios de cada ítem del Book, Coberturas y Complementos, por tipo de evento
- Regla de desbloqueo de la Halley Box
- Política de reserva: monto fijo vs. porcentaje del total
- Si el Book (Parte 1) es de selección única o admite combinar varias opciones (ej. Preparativos + Cobertura fiesta)
- Contenido real de la Halley Box y de qué empresas aliadas participan

## 7. Consideraciones técnicas

- Stack: Next.js + TypeScript + tRPC + Prisma + Supabase
- Estado del wizard: manejar en cliente (Context/Zustand) durante el armado, y persistir a Prisma recién al confirmar — o ir guardando drafts paso a paso para soportar "Reeditar" desde el código de seguimiento
- Generación de código de seguimiento único por presupuesto
- Link de WhatsApp con mensaje prellenado (incluye código de seguimiento)
- Envío de copia por email opcional (según toggle del paso 4)
- Descarga de presupuesto en PDF
