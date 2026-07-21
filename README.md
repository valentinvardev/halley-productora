# Halley — cobros a grupos de padres

Demo funcional del módulo de cobros para **Halley Producciones**, hecha por SurCodia.
La especificación completa del producto está en [`Halley_Especificacion.md`](Halley_Especificacion.md)
y el sistema visual en [`halley-design-system.html`](halley-design-system.html).

El código de la app vive en [`halley-app/`](halley-app).

## Alcance de esta demo

Incluye el circuito de cobros de punta a punta:

- **Panel de administración** — alta de grupos, carga de padres (uno por uno o
  pegando una lista), estado de cobro por padre con las marcas del sistema de
  diseño, invitaciones y recordatorios.
- **Onboarding del padre** — dos caminos: el administrador carga la lista, o el
  padre se anota solo desde el link público del grupo (`/g/[slug]`).
- **Página del padre** — link personal sin login (`/p/[token]`) con el monto, el
  QR y el alias copiable.
- **Pagos** — webhook real (`POST /api/webhooks/talo`), procesamiento idempotente,
  actualización del estado y notificaciones automáticas.

Fuera de alcance por ahora: vitrina/portfolio, likes de prospectos, S3, WhatsApp.

## Decisiones de la demo

| Tema | Cómo está resuelto |
|---|---|
| **Talo** | Adaptador con dos implementaciones detrás de una misma interfaz (`src/server/talo/`). En modo `mock` genera CVU/alias y habilita el simulador de transferencias. El webhook y el procesamiento del pago son los definitivos: sólo se simula quién dispara la transferencia. |
| **Emails** | No sale nada a internet. Cada mensaje que el sistema enviaría queda en la tabla `Notificacion` y se ve en la **Bandeja** del panel. Al conectar Resend se reemplaza `entregar()` en `src/server/notificaciones.ts`. |
| **Login del panel** | Una sola clave compartida (`ADMIN_PASSWORD`) en una cookie httpOnly. Cuando Halley necesite varias cuentas, se cambia por Supabase Auth sin tocar los routers. |
| **Vencido** | No se persiste ni depende de un cron: se deriva de la fecha al leer, así el panel siempre dice la verdad. |
| **QR** | Codifica alias + CVU + monto como texto. El QR interoperable real lo devuelve Talo junto con el CVU. |

## Stack

Next.js (App Router) · TypeScript · tRPC · Prisma · PostgreSQL (Supabase) · Tailwind v4

## Cómo correrlo

```bash
cd halley-app
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

El `package.json` no está en la raíz del repo, así que hay que decírselo a Vercel:

**Settings → Build and Deployment → Root Directory → `halley-app`.**
Sin eso falla con *"No Next.js version detected"*.

Variables de entorno a cargar en el proyecto (Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Session pooler de Supabase |
| `DIRECT_URL` | igual que la anterior |
| `ADMIN_PASSWORD` | la clave del panel |
| `ADMIN_EMAIL` | casilla que recibe el aviso de cada pago |
| `TALO_MODE` | `mock` |
| `NEXT_PUBLIC_APP_URL` | **el dominio de Vercel**, no `localhost` |

`NEXT_PUBLIC_APP_URL` es la que más se olvida: de ahí salen los links personales
que se le mandan a cada padre y ahí le pega el simulador al webhook. Si queda en
`localhost`, los links del deploy apuntan a la máquina de quien los abre.

`prisma generate` ya corre solo en el build (script `postinstall`). Las tablas se
crean una vez con `npm run db:push` desde tu máquina, no en el deploy.

## Guión de la demostración

1. **Panel → Grupos.** Dos grupos cargados: uno al día y otro vencido. La tira de
   marcas muestra el estado del grupo de un vistazo.
2. **Entrar a "Egresados 2027".** Métricas arriba, tabla de padres abajo con
   circulado / punteado / tachado.
3. **Agregar un padre** (o pegar una lista). Se crea el customer en Talo, se
   genera CVU y alias, y sale la invitación.
4. **Copiar el link de ese padre y abrirlo en otra pestaña** (o en el celular).
   Es la página sin login: monto, QR, alias.
5. **Apretar "Simular transferencia desde el banco".** Eso registra la
   transferencia y dispara el webhook igual que lo haría Talo.
6. **Volver al panel sin recargar:** en pocos segundos el padre pasa a circulado
   y sube el recaudado. La página del padre también cambia sola a "Pago acreditado".
7. **Bandeja.** Ahí están la invitación, la confirmación al padre y el aviso a
   Halley, con el texto exacto que se va a enviar.
8. **Link de auto-registro del grupo** — abrirlo y anotarse como un padre nuevo:
   queda en la tabla marcado como "se anotó solo", con su propio link.

## Pendiente para producción

- Credenciales de Talo (KYC de la cuenta comercial) y pasar `TALO_MODE=real`.
- Verificación de firma del webhook de Talo.
- Resend para el envío real de los emails.
- Cron de recordatorios (hoy se disparan a mano desde el panel).
- Módulo de vitrina y likes de prospectos.
