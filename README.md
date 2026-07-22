# Halley — cobros a grupos de padres

Demo funcional del módulo de cobros para **Halley Producciones**, hecha por SurCodia.
La especificación completa del producto está en [`docs/Halley_Especificacion.md`](docs/Halley_Especificacion.md)
y el sistema visual en [`docs/halley-design-system.html`](docs/halley-design-system.html).

## Alcance de esta demo

Incluye el circuito de cobros de punta a punta:

- **Panel de administración** — grupos con plan de N cuotas, carga de alumnos
  (uno por uno o pegando una lista), estado de cada plan con las marcas del
  sistema de diseño, invitaciones, recordatorios y galería del grupo.
- **Cuenta de la familia** — registro desde el link del grupo (`/g/[slug]`)
  eligiendo al hijo de un desplegable, y login sólo con email: le llega un link
  y entra, sin contraseña.
- **Dashboard de la familia** (`/mi`) — el pago de principio a fin: lo pagado, lo
  que falta, el plan completo cuota por cuota, los datos para transferir y el
  acceso a la galería.
- **Link sin login** (`/p/[token]`) — sigue funcionando para quien no se quiera
  registrar: es el que ya salió por mail.
- **Pagos** — webhook real (`POST /api/webhooks/talo`), procesamiento idempotente
  e imputación a la cuota impaga más vieja.

Fuera de alcance por ahora: la galería propia con las fotos alojadas (hoy es el
link de Drive), vitrina/portfolio, likes de prospectos, WhatsApp.

## Decisiones de la demo

| Tema | Cómo está resuelto |
|---|---|
| **Talo** | Adaptador con dos implementaciones detrás de una misma interfaz (`src/server/talo/`). En modo `mock` genera CVU/alias y habilita el simulador de transferencias. El webhook y el procesamiento del pago son los definitivos: sólo se simula quién dispara la transferencia. |
| **Emails** | Resend, con interruptor. Todo mensaje se registra siempre en la tabla `Notificacion` y se ve en la **Bandeja** del panel; con `EMAIL_MODE=resend` además sale de verdad y se guarda el resultado del envío. Con `EMAIL_MODE=bandeja` (la demo) no sale nada a internet. |
| **Login del panel** | Una sola clave compartida (`ADMIN_PASSWORD`) en una cookie httpOnly. Cuando Halley necesite varias cuentas, se cambia por Supabase Auth sin tocar los routers. |
| **Login de la familia** | Sólo email: se manda un link de un solo uso que dura 30 minutos y se canjea por una sesión. Sin contraseñas que recordar, filtrar ni resetear. |
| **Quién reclama a un alumno** | Cualquiera con el link del grupo puede elegir a su hijo, pero **el primero que lo reclama se lo queda**: sin eso, dos personas se pisarían y la segunda vería los datos de la primera. El admin puede desvincular desde el panel. La pantalla pública sólo expone nombre del alumno y si está tomado — ni emails ni montos. |
| **Estado de las cuotas** | No se persiste: se deriva repartiendo lo pagado sobre el plan, de la cuota más vieja a la más nueva. Así un pago parcial, uno de más o dos cuotas juntas se acomodan solos, y el panel no puede terminar diciendo algo distinto de lo que dicen los pagos. |
| **Modo oscuro** | El *negativo*: no hay paleta aparte, se invierten los mismos tokens de color. Sigue la preferencia del sistema y el botón "Negativo / Positivo" la pisa. El QR se mantiene siempre en positivo para que los lectores lo tomen. |
| **QR** | Codifica alias + CVU + monto como texto. El QR interoperable real lo devuelve Talo junto con el CVU. |

## Stack

Next.js (App Router) · TypeScript · tRPC · Prisma · PostgreSQL (Supabase) · Tailwind v4

## Cómo correrlo

```bash
cp .env.example .env      # completar DATABASE_URL y DIRECT_URL de Supabase
npm install
npm run db:push           # crea las tablas
npm run dev
```

Entrar a `http://localhost:3000/admin` con la clave de `ADMIN_PASSWORD`
(por defecto `halley2026`) y apretar **Cargar datos de demo**.

> **Ojo con el puerto.** `NEXT_PUBLIC_APP_URL` tiene que coincidir con el puerto
> real: de ahí salen los links personales de cada padre y ahí le pega el
> simulador al webhook. Si el 3000 está ocupado y Next arranca en el 3001,
> actualizá la variable (o levantá con `npm run dev -- --port 3000`).
>
> **Supabase por IPv4.** La conexión directa (`db.<ref>.supabase.co`) sólo
> publica registro AAAA: desde una red sin IPv6 no se alcanza. Por eso las dos
> variables apuntan al *Session pooler*
> (`postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432`).

## Deploy en Vercel

La app está en la raíz del repo, así que Vercel detecta Next solo: **Root
Directory se deja vacío**. Lo único que hay que cargar son las variables de
entorno (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Session pooler de Supabase |
| `DIRECT_URL` | igual que la anterior |
| `ADMIN_PASSWORD` | la clave del panel |
| `ADMIN_EMAIL` | casilla que recibe el aviso de cada pago |
| `TALO_MODE` | `mock` |
| `EMAIL_MODE` | `bandeja` para la demo, `resend` para enviar de verdad |
| `RESEND_API_KEY` | sólo si `EMAIL_MODE=resend` |
| `EMAIL_FROM` | remitente verificado en Resend |
| `NEXT_PUBLIC_APP_URL` | **el dominio de Vercel**, no `localhost` |

`NEXT_PUBLIC_APP_URL` es la que más se olvida: de ahí salen los links personales
que se le mandan a cada padre y ahí le pega el simulador al webhook. Si queda en
`localhost`, los links del deploy apuntan a la máquina de quien los abre.

Las variables se validan **durante el build** ([`src/env.js`](src/env.js)): si
falta `DATABASE_URL` o `DIRECT_URL`, el deploy falla ahí. `prisma generate` ya
corre solo (script `postinstall`), y las tablas se crean una única vez con
`npm run db:push` desde tu máquina, no en el deploy.

## Guión de la demostración

1. **Panel → Grupos.** Dos grupos cargados. La tira de marcas muestra el estado
   de cobranza de un vistazo.
2. **Entrar a "Egresados 2027".** Arriba las métricas y el plan de 6 cuotas;
   abajo la tabla de alumnos, cada uno con una marca por cuota.
3. **Copiar el link de registro del grupo y abrirlo en otra pestaña.** Es lo que
   se le manda a las familias.
4. **Elegir un hijo del desplegable y poner un email.** El botón está inactivo
   hasta que se elija. En modo demo el link de acceso se muestra en pantalla en
   vez de mandarse por mail.
5. **Abrir ese link:** entra al dashboard de la familia, con el plan completo de
   principio a fin y la galería.
6. **Apretar "Simular transferencia desde el banco".** Registra la transferencia
   y dispara el webhook igual que lo haría Talo.
7. **Sin recargar:** la cuota pasa a círculo con tilde en el dashboard y en el
   panel del admin al mismo tiempo.
8. **Bandeja.** Ahí están la invitación, el link de acceso, la confirmación a la
   familia y el aviso a Halley, con el texto exacto que se va a enviar.

## Emails con Resend

La integración ya está hecha ([`src/server/email.ts`](src/server/email.ts)) y se
enciende con dos variables:

```bash
EMAIL_MODE="resend"
RESEND_API_KEY="re_..."
EMAIL_FROM="Halley Producciones <cobros@tudominio.com>"
```

Tres cosas a tener en cuenta:

- **Hasta verificar un dominio en Resend**, el remitente de prueba
  `onboarding@resend.dev` sólo puede escribirle a la casilla con la que creaste
  la cuenta. Para mandarle a padres reales hay que verificar el dominio de
  Halley (registros DNS) y usar una dirección de ahí.
- **El registro es siempre primero.** El mensaje se guarda en `Notificacion`
  aunque el envío falle, y el error queda visible en la Bandeja. Un problema con
  Resend nunca tumba el pago que lo disparó.
- **Para la demo conviene `EMAIL_MODE=bandeja`**: los emails de prueba van a
  direcciones inventadas (`fernando.rios@mail.com`), y mandarlos de verdad sólo
  ensucia la reputación del dominio con rebotes.

## Pendiente para producción

- Credenciales de Talo (KYC de la cuenta comercial) y pasar `TALO_MODE=real`.
- Verificación de firma del webhook de Talo.
- Verificar el dominio de Halley en Resend y pasar `EMAIL_MODE=resend`.
- Cron de recordatorios (hoy se disparan a mano desde el panel).
- Módulo de vitrina y likes de prospectos.
