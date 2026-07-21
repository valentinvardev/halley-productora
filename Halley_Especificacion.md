# Halley — Especificación funcional y técnica

**Cliente:** Halley Producciones (Córdoba) — productora de egresados, bodas y eventos similares.
**Preparado por:** SurCodia
**Última actualización:** Julio 2026

---

## 1. Resumen

Halley necesita un producto con tres módulos funcionales que comparten una misma base técnica:

1. **Vitrina de trabajos** — portfolio categorizado ("mercadolibre de fotografías"): landing general + página por categoría.
2. **Selección de servicios** — formulario de contacto/cotización potenciado por un sistema de preferencias basado en "likes" sobre fotos de la categoría elegida.
3. **Cobros a grupos de padres (colegios)** — automatización de cobros vía Talo, panel de administración, recordatorios y confirmaciones.

Los tres módulos viven en un mismo proyecto (mismo stack, mismo dashboard de administración), pero son independientes entre sí: un colegio puede usar solo el módulo de cobros sin tocar el portfolio, y un visitante de la web puede navegar el portfolio sin nunca llegar al módulo de pagos.

---

## 2. Módulos funcionales

### 2.1 Vitrina / Portfolio

- **Landing general:** muestra de trabajos de todas las categorías (egresados, bodas, comuniones, etc.), con navegación por categoría.
- **Página por categoría:** grilla de trabajos correspondientes a esa categoría únicamente.
- **Detalle de trabajo:** galería de fotos de un evento/sesión puntual.
- Concepto guía del cliente: un catálogo navegable por tipo de servicio, no una landing única — la variedad de servicios se exhibe a través de la categorización, como un marketplace de fotografía.

### 2.2 Selección de servicios + preferencias por "like"

- **Formulario de contacto/cotización:** el cliente potencial indica qué tipo de evento busca (categoría) y sus datos de contacto.
- **Mecanismo de preferencia:** dentro de la categoría elegida, el cliente recorre una selección de fotos de trabajos anteriores y marca cuáles le gustan (tipo swipe/like).
- **Objetivo:** que Halley entienda el estilo/preferencia visual del cliente antes de cotizar — no es solo "guardar favoritos", alimenta la conversación comercial posterior.
- **Pendiente de decidir con Halley:** si el resultado del "like" solo queda visible para el fotógrafo en el panel, o si además dispara una sugerencia automática de paquete/servicio.

### 2.3 Cobros a grupos de padres (colegios)

Ya especificado en detalle en la propuesta enviada a Halley (`Halley_Propuesta_Pagos_Talo.pdf`). Resumen funcional:

- Halley crea un **grupo** por colegio/evento (ej. "Egresados 2027 – Colegio San Martín").
- Se carga la lista de padres del grupo; el sistema genera un alias/CVU único por padre vía la Customers API de Talo.
- Cada padre recibe un **link personal, sin login**, con el monto de su cuota y las dos formas de pago (QR interoperable o alias copiable).
- Talo notifica cada pago por webhook en tiempo real → el panel actualiza el estado → se dispara confirmación automática por email al padre y al administrador.
- Recordatorios automáticos por email a quienes no pagaron, con la frecuencia que Halley defina.
- **WhatsApp queda fuera del alcance inicial:** el administrador ya usa Hariaz (hariaz.com) para responder WhatsApp, y no está confirmado si expone una API para disparar mensajes desde nuestro sistema sin pisar ese bot. Se evalúa como fase 2, condicionado a confirmar con Hariaz (o a usar un número de WhatsApp Business dedicado).
- Como respaldo manual mientras tanto: el administrador puede copiar el link personal del padre y enviarlo él mismo por WhatsApp.

---

## 3. Arquitectura técnica

### 3.1 Stack

- **Next.js + TypeScript** (App Router)
- **tRPC** para la capa de API interna
- **Prisma** como ORM
- **Supabase** (Postgres + Storage para las imágenes del portfolio)
- **Talo** como proveedor de pagos (Customers API + Webhooks)
- Servicio de email transaccional (a definir — Resend es la opción por defecto dado el resto del stack)

### 3.2 Modelo de datos (borrador)

```prisma
model Categoria {
  id          String    @id @default(cuid())
  nombre      String    // "Egresados", "Bodas", "Comuniones", etc.
  slug        String    @unique
  trabajos    Trabajo[]
}

model Trabajo {
  id          String     @id @default(cuid())
  titulo      String
  categoriaId String
  categoria   Categoria  @relation(fields: [categoriaId], references: [id])
  fotos       Foto[]
  destacado   Boolean    @default(false)
}

model Foto {
  id          String   @id @default(cuid())
  trabajoId   String
  trabajo     Trabajo  @relation(fields: [trabajoId], references: [id])
  url         String
  likes       Like[]
}

model Prospecto {
  id          String   @id @default(cuid())
  nombre      String
  contacto    String   // email / teléfono
  categoriaId String
  likes       Like[]
  creadoEn    DateTime @default(now())
}

model Like {
  id          String    @id @default(cuid())
  prospectoId String
  prospecto   Prospecto @relation(fields: [prospectoId], references: [id])
  fotoId      String
  foto        Foto      @relation(fields: [fotoId], references: [id])
}

model Grupo {
  id          String   @id @default(cuid())
  nombre      String   // "Egresados 2027 – Colegio San Martín"
  colegio     String
  montoCuota  Decimal
  padres      Padre[]
  creadoEn    DateTime @default(now())
}

model Padre {
  id            String   @id @default(cuid())
  nombre        String
  email         String
  grupoId       String
  grupo         Grupo    @relation(fields: [grupoId], references: [id])
  taloCustomerId String  @unique   // customer_id que Talo devuelve
  cvu           String
  alias         String
  estado        EstadoPago @default(PENDIENTE)
  pagos         Pago[]
}

model Pago {
  id            String   @id @default(cuid())
  padreId       String
  padre         Padre    @relation(fields: [padreId], references: [id])
  monto         Decimal
  taloTransactionId String @unique
  recibidoEn    DateTime @default(now())
}

enum EstadoPago {
  PENDIENTE
  PAGADO
  VENCIDO
}
```

> Nota: este es un borrador de arranque, no el modelo final — falta validar con Halley si un padre puede tener más de un hijo/grupo, y si el monto de la cuota puede variar por padre dentro del mismo grupo.

### 3.3 Integración con Talo

- **Alta de padre:** al crear un `Padre`, el backend llama a `POST /customers/` de Talo con `customer_id` (nuestro id interno), `name`, `contact.email` y `webhook_url` propio. Se guarda el `cvu`/`alias` que Talo devuelve.
- **Webhook de pago recibido:** Talo notifica `{ message: "Pago recibido", transactionId, customerId }`. El handler:
  1. Responde `200 OK` inmediatamente (sin lógica pesada adentro).
  2. Encola un job que consulta `GET /customers/{customer_id}/transactions/{transaction_id}` para confirmar monto y fecha.
  3. Actualiza `Padre.estado = PAGADO` y crea el registro `Pago`.
  4. Dispara el email de confirmación al padre y la notificación al administrador.
- **Cuenta comercial de Halley:** alta como SAS (KYC), activación en hasta 36 hs, notificación `account_activated` vía webhook de partners. Configuración de `payout_schedule` para que los fondos cobrados se transfieran a la cuenta de Halley con la frecuencia que elijan.

### 3.4 Notificaciones

| Evento | Canal (fase 1) | Canal (fase 2, a confirmar) |
|---|---|---|
| Invitación inicial al padre | Email | + WhatsApp (si Hariaz lo permite, o número dedicado) |
| Confirmación de pago (padre) | Email | + WhatsApp |
| Notificación de pago (administrador) | Email / panel | + WhatsApp |
| Recordatorio de cuota pendiente | Email, cron programable | + WhatsApp |

### 3.5 Páginas para el padre (sin login)

- Cada padre tiene una URL personal con un token único (no un usuario/contraseña).
- La página muestra: nombre del grupo/colegio, monto adeudado, fecha límite, botón de pago (QR interoperable generado a partir del CVU + alias copiable con un click).
- Sin estado persistente del lado del padre — la página siempre refleja el estado actual consultando el backend.

---

## 4. Flujos clave

**Alta de un grupo nuevo:**
1. Admin crea el grupo (nombre, colegio, monto de cuota).
2. Carga la lista de padres (nombre + email), en bloque o uno por uno.
3. El sistema crea un `customer` en Talo por cada padre y guarda el CVU/alias.
4. Se envía la invitación inicial por email a cada padre con su link personal.

**Pago de un padre:**
1. El padre abre su link, ve el monto, escanea el QR o copia el alias.
2. Transfiere desde su banco/billetera habitual.
3. Talo dispara el webhook → el sistema confirma → actualiza estado → dispara confirmación (padre + admin).

**Recordatorio:**
1. Un cron (frecuencia configurable por Halley) revisa los `Padre` en estado `PENDIENTE`.
2. Envía el recordatorio por email a cada uno.

**Selección de servicio (prospecto):**
1. El visitante completa el formulario y elige una categoría.
2. Ve una selección de fotos de esa categoría y marca sus "likes".
3. Halley recibe el prospecto con sus likes asociados, para usar en la cotización.

---

## 5. Sistema de diseño

Ver archivo adjunto `halley-design-system.html` — sistema visual en blanco y negro (identidad de "hoja de contacto" fotográfica) con los tokens, componentes base y mockups de las pantallas de los tres módulos.

---

## 6. Pendiente de confirmar con Halley

- Si el "like" debe sugerir un paquete automáticamente o solo queda como referencia interna.
- Si un padre puede pertenecer a más de un grupo/colegio a la vez.
- Si el monto de la cuota puede variar por padre dentro del mismo grupo (becas, descuentos).
- Qué plataforma corre el bot de Hariaz y si expone una API para disparar mensajes (define si WhatsApp entra en fase 1 o fase 2).
- Frecuencia deseada de los recordatorios automáticos.
