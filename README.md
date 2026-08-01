# Halley — cobros, galerías y vitrina

Sistema de **Halley Audiovisual** (Córdoba), hecho por SurCodia: cobra planes de
cuotas a familias de egresados y a clientes particulares, entrega el material por
galerías privadas y publica la vitrina de la productora.

La especificación del producto está en
[`docs/Halley_Especificacion.md`](docs/Halley_Especificacion.md) y el sistema
visual en [`docs/halley-design-system.html`](docs/halley-design-system.html).

---

## Qué incluye

### Cobros

- **Grupos de egresados** — plan de N cuotas mensuales, carga de alumnos (uno por
  uno o pegando una lista), estado de cada plan con las marcas del sistema de
  diseño, invitaciones y recordatorios.
- **Clientes particulares** (bodas, 15) — un cliente único con su propio plan, con
  las cuotas cargadas de a una: una seña y un saldo no son iguales ni mensuales.
- **Dos proveedores**: Talo (transferencia a un CVU por alumno) y Mercado Pago
  (Checkout Pro). Cada grupo se rutea a la cuenta que cobra.
- **Cuentas de pago** — cada socio tiene la suya; el dinero de cada evento cae
  donde corresponde. La de Mercado Pago se vincula con un botón (OAuth).
- **Imputación derivada** — el estado de cada cuota no se guarda: se calcula
  repartiendo lo pagado, de la cuota más vieja a la más nueva, con la mora.

### Acceso de la familia

- **Registro** desde el link del grupo (`/g/[slug]`) eligiendo al hijo de una
  lista, y login sólo con email: le llega un link de un solo uso y entra.
- **Dashboard** (`/mi`) — el pago de principio a fin, el plan cuota por cuota, los
  datos para transferir y la galería.
- **Link sin login** (`/p/[token]`) — para quien no se quiera registrar; es el que
  ya salió por mail.

### Galerías

Dos tipos, mismo visor:

- **De entrega** — cuelgan de un grupo y se liberan al saldar el plan. Es el
  material que se entrega una vez paga la cuota.
- **Nativas** — sueltas, con su propio link para compartir, contraseña opcional y
  vencimiento. No dependen de ningún cobro.

En los dos casos las fotos se sirven firmadas y con permiso chequeado en el
servidor, y la descarga en iPhone abre el menú de guardar en la galería.

### Vitrina

- **Contenidos** por categoría (egresados, bodas, quince, marcas) que el admin
  sube a S3 y la landing muestra, con portadas rotativas y hero configurable.
- **Pedido de presupuesto** — el visitante marca las fotos que le gustan con un
  corazón y el mensaje sale por WhatsApp al número que se configura en Ajustes.

---

## Mapa de rutas

| Ruta | Quién entra | Qué es |
|---|---|---|
| `/` | público | Landing con la vitrina |
| `/servicios/[slug]` | público | Egresados, bodas, quince, marcas |
| `/g/[slug]` | público | Registro de la familia en un grupo |
| `/entrar` · `/registro` | público | Login de la familia |
| `/acceso/[token]` | público | Canje del link de acceso |
| `/p/[token]` | link personal | Pago y galería sin login |
| `/mi` | sesión de familia | Dashboard |
| `/mi/pagar/[alumnoId]` | sesión de familia | Pantalla de cobro |
| `/galeria/[token]` | link (+ contraseña) | Galería nativa |
| `/admin` | clave del panel | Grupos y particulares |
| `/admin/grupos/[id]` | clave del panel | Detalle, alumnos, galerías, cuenta que cobra |
| `/admin/galerias` | clave del panel | Galerías para compartir |
| `/admin/contenidos` | clave del panel | Vitrina |
| `/admin/cuentas` | clave del panel | Cuentas de pago |
| `/admin/notificaciones` | clave del panel | Bandeja de emails |
| `/admin/ajustes` | clave del panel | WhatsApp, Instagram, contacto |
| `/api/webhooks/talo` | Talo | Aviso de transferencia |
| `/api/webhooks/mercadopago` | Mercado Pago | Aviso de pago (firma verificada) |
| `/api/oauth/mercadopago` | Mercado Pago | Vuelta de la vinculación |
| `/api/galeria/[fotoId]` | con permiso | Sirve una foto privada, firmada |
| `/api/contenido/[id]` | público | Sirve una pieza de la vitrina |

---

## Decisiones

| Tema | Cómo está resuelto |
|---|---|
| **Estado de las cuotas** | No se persiste: se deriva repartiendo lo pagado sobre el plan, de la más vieja a la más nueva. Así un pago parcial, uno de más o dos cuotas juntas se acomodan solos, y el panel no puede terminar diciendo algo distinto de lo que dicen los pagos. |
| **Mora** | Toda cuota vence el 20. El recargo corre desde ahí: 0 hasta los 2 meses vencida, 3% a los 2, sube parejo hasta 5% a los 5 y se queda. Sale derivado como todo lo demás (`recargoPorMora` en [`dominio.ts`](src/server/dominio.ts)). |
| **Particulares** | Un particular es un grupo de uno: mismo modelo (`Grupo` con `tipo=PARTICULAR` y un solo `Alumno`), así reutiliza la imputación, los pagos, las galerías, el panel de la familia y los avisos sin lógica nueva. El campo `colegio` guarda el tipo de evento. |
| **Ruteo de cobros** | Cada grupo apunta a una `CuentaPago`; sin una elegida cobra la marcada por defecto. La credencial nunca sale del servidor: el panel ve los últimos cuatro caracteres. |
| **Talo** | Adaptador con dos implementaciones detrás de una interfaz (`src/server/talo/`). En `mock` genera CVU/alias; el webhook y el procesamiento del pago son los definitivos. La autenticación es un token de una hora que se renueva solo: Talo no da API key fija. |
| **Mercado Pago** | Checkout Pro: se crea una preferencia con el monto exacto y se redirige. El token es **por socio** (en su `CuentaPago`), no global. En `mock` una pantalla propia imita el checkout para poder recorrer el flujo sin plata real. |
| **Confirmación de un pago** | El webhook es sólo un aviso: el pago se vuelve a consultar contra la API del proveedor con su token antes de registrar nada. Un aviso inventado no puede fabricar plata. Idempotente por `Pago.refPago`. |
| **Galería de entrega** | Se libera cuando `deuda <= 0` — el plan completo, mora incluida. La regla se aplica en el servidor, en el punto donde se sirve el archivo: esconder un botón no protege un archivo. |
| **Material privado vs. vitrina** | La vitrina sale por CloudFront (cacheada, barata). El material de las familias **nunca**: se firma en S3 con vencimiento corto y recién después de chequear el permiso. |
| **Descarga en iPhone** | Safari ignora `download` y abre la imagen, sin forma clara de guardarla. Se usa la Web Share API con el archivo: abre la hoja nativa con "Guardar imagen". Si el navegador no la soporta, cae a la descarga común. |
| **Responsables de un alumno** | Hasta 3 (`MAX_RESPONSABLES`): los dos padres y un tercero. Más que eso deja de ser una familia y empieza a ser una filtración. La pantalla pública sólo expone el nombre del alumno y si quedan lugares. |
| **Login del panel** | Una sola clave compartida (`ADMIN_PASSWORD`) en una cookie httpOnly, con freno de fuerza bruta. Cuando Halley necesite varias cuentas se cambia por Supabase Auth sin tocar los routers. |
| **Login de la familia** | Sólo email: un link de un solo uso que dura 30 minutos y se canjea por una sesión. Sin contraseñas que recordar, filtrar ni resetear. |
| **Emails** | Resend con interruptor. Todo mensaje se registra en `Notificacion` y se ve en la Bandeja; con `EMAIL_MODE=resend` además sale de verdad. El registro es siempre primero: un problema con Resend nunca tumba el pago que lo disparó. |
| **Modo oscuro** | El *negativo*: no hay paleta aparte, se invierten los mismos tokens. Sigue al sistema y el botón lo pisa. El QR queda siempre en positivo para que los lectores lo tomen. |

---

## Seguridad

Lo que hay que entender antes de tocar el entorno. Auditoría completa: commit
`f682023`.

### Las herramientas de demo son puertas abiertas

El simulador de transferencias, la confirmación de pagos falsos de Mercado Pago y
el ingreso de familias sin verificar el email existen para poder recorrer el
sistema sin plata real ni casilla de correo. Con eso encendido **cualquiera puede
darse por pagado sin transferir —y destrabar la galería— y entrar a la cuenta de
otro sabiendo su email**.

Todas pasan por `demoAbierta()` en [`src/server/demo.ts`](src/server/demo.ts):
cerradas en producción salvo `DEMO_ABIERTA="si"`, disponibles fuera de producción.
**Si se agrega una herramienta de demo nueva, tiene que preguntarle a esa
función.**

### Defensas puestas

- **Fuerza bruta** — 5 intentos y después espera exponencial hasta 15 minutos, por
  IP, en el login del panel y en la contraseña de galería
  ([`limite-intentos.ts`](src/server/limite-intentos.ts)). Vive en memoria del
  proceso: si algún día corren varias instancias, hay que moverlo a un almacén
  compartido.
- **Cabeceras** — CSP, `nosniff`, `frame-ancestors none`, HSTS, Referrer-Policy y
  Permissions-Policy en [`next.config.js`](next.config.js).
- **Firma de webhooks** — la de Mercado Pago se verifica (HMAC-SHA256) si
  `MP_WEBHOOK_SECRET` está configurada, con tolerancia de 5 minutos contra
  reenvíos.
- **OAuth** — el callback exige sesión de admin **y** un `state` de un solo uso.
  Sin el `state`, alguien podría hacernos canjear un código suyo y quedar
  cobrando en su cuenta.
- **Galerías** — el permiso se chequea al servir cada archivo, no en la pantalla.

### Al desplegar

1. **No definas `DEMO_ABIERTA`** y asegurate de que `NODE_ENV=production`.
2. `AUTH_PADRES` en `enlace` (es el default) — `directo` sólo sirve para demo.
3. Cambiá `ADMIN_PASSWORD`: la del ejemplo es débil y es la llave de todo el panel.

---

## Stack

Next.js (App Router) · TypeScript · tRPC v11 · Prisma · PostgreSQL (Supabase) ·
Tailwind v4 · S3 + CloudFront · Resend

El cliente de Prisma se genera en `generated/` (fuera de git) y el build lo
regenera solo. [`src/server/db.ts`](src/server/db.ts) importa `server-only`: si
algún módulo de servidor se cuela en un bundle del navegador, el build falla ahí
en vez de romperse en la pantalla de alguien.

---

## Cómo correrlo

```bash
cp .env.example .env      # completar DATABASE_URL y DIRECT_URL de Supabase
npm install
npm run db:push           # crea las tablas
npm run dev
```

Entrar a `http://localhost:3000/admin` con la clave de `ADMIN_PASSWORD` y apretar
**Cargar datos de demo**.

> **Ojo con el puerto.** `NEXT_PUBLIC_APP_URL` tiene que coincidir con el puerto
> real: de ahí salen los links personales de cada padre y ahí le pega el
> simulador al webhook. Si el 3000 está ocupado y Next arranca en el 3001,
> actualizá la variable (o levantá con `npm run dev -- --port 3000`).
>
> **Mercado Pago real no se puede probar en local.** El `auto_return` de MP
> rechaza `localhost`, así que en tu máquina `MP_MODE` queda en `mock`.
>
> **Supabase por IPv4.** La conexión directa (`db.<ref>.supabase.co`) sólo
> publica registro AAAA: desde una red sin IPv6 no se alcanza. Por eso las dos
> variables apuntan al *Session pooler*.
>
> **La región importa, y mucho.** Cada consulta paga el viaje hasta la base y una
> pantalla hace varias. Con el proyecto en `ca-central-1` medimos 250–500 ms por
> consulta y 2–4 s para abrir la pantalla de cobro desde Córdoba; en `sa-east-1`
> (São Paulo) es una fracción.

---

## Variables de entorno

Se validan **durante el build** ([`src/env.js`](src/env.js)): si falta
`DATABASE_URL` o `DIRECT_URL`, el build falla ahí.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` · `DIRECT_URL` | Session pooler de Supabase |
| `ADMIN_PASSWORD` | Clave del panel |
| `ADMIN_EMAIL` | Casilla que recibe el aviso de cada pago |
| `NEXT_PUBLIC_APP_URL` | **El dominio real**, no `localhost` |
| `TALO_MODE` | `mock` o `real` |
| `TALO_API_URL` · `TALO_CLIENT_ID` · `TALO_CLIENT_SECRET` · `TALO_USER_ID` | Sólo con `TALO_MODE=real`. Se canjean por un token de 1 hora que se renueva solo |
| `MP_MODE` | `mock` o `real` |
| `MP_CLIENT_ID` · `MP_CLIENT_SECRET` | App de MP: habilitan el botón de vincular |
| `MP_WEBHOOK_SECRET` | Verifica la firma de los avisos de MP |
| `EMAIL_MODE` | `bandeja` (no sale nada) o `resend` |
| `RESEND_API_KEY` · `EMAIL_FROM` | Sólo con `EMAIL_MODE=resend` |
| `EMAIL_REPLY_TO` | Casilla real a la que llegan las respuestas de las familias |
| `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` | Credenciales del bucket |
| `AWS_REGION` · `AWS_S3_BUCKET` | Dónde vive el contenido |
| `AWS_S3_PREFIX` | **La carpeta de este cliente** dentro del bucket (ej. `halley`) |
| `CLOUDFRONT_DOMAIN` | CDN delante del bucket para la vitrina |
| `AUTH_PADRES` | `enlace` (default, correcto) o `directo` (sólo demo) |
| `DEMO_ABIERTA` | `si` abre las herramientas de demo **en producción** |

Las de AWS son opcionales: sin ellas la subida se apaga sola y la landing usa las
imágenes de relleno. `AWS_S3_PREFIX` es lo que aísla las fotos de Halley de las de
otro proyecto que comparta el bucket.

`NEXT_PUBLIC_APP_URL` es la que más se olvida: de ahí salen los links que se le
mandan a cada familia, la `notification_url` de Mercado Pago y la URL de retorno
del OAuth. Si queda en `localhost`, nada de eso funciona.

---

## Actualizar el server

```bash
git pull
npm install        # sólo si cambiaron dependencias
npm run build      # regenera el cliente de Prisma y compila
pm2 restart halley
```

`npm run build` corre `prisma generate` primero. Es a propósito: `generated/` está
fuera de git, así que después de un pull que toca el schema el server compilaría
contra el cliente viejo y fallaría con un error de tipos que no existe en el
código.

Los cambios de schema se aplican una vez con `npm run db:push` (desde tu máquina o
desde el server, apuntando a la misma base), no en cada deploy.

---

## Poner Mercado Pago en real

1. En `mercadopago.com.ar/developers` → **Tus integraciones** → tu app, copiá el
   **Client ID** y el **Client Secret** de producción a `MP_CLIENT_ID` y
   `MP_CLIENT_SECRET`.
2. En esa misma pantalla registrá la **URL de redirección**, exacta:
   `https://TU-DOMINIO/api/oauth/mercadopago`. Sin esto MP rechaza el canje; es el
   paso que más se olvida.
3. En **Webhooks**, configurá la URL y copiá la clave secreta a
   `MP_WEBHOOK_SECRET`. Para Checkout Pro no hace falta para *recibir* los avisos
   —la `notification_url` va en cada preferencia—, pero sí para verificar la firma.
4. `MP_MODE="real"` y reiniciar.
5. En **/admin/cuentas** → **Conectar Mercado Pago**: le ponés nombre a la cuenta,
   el socio autoriza y queda vinculada. Después, en el detalle del grupo, le
   asignás esa cuenta.

El access token de OAuth **vence a los 180 días** y se renueva solo antes de cada
uso (`tokenVigente()`). Nada lee `credencial` directo: si se hiciera, los cobros de
ese socio se cortarían un día sin aviso.

La carga manual del token sigue existiendo, para Talo y como salida de respaldo.

---

## Emails con Resend

```bash
EMAIL_MODE="resend"
RESEND_API_KEY="re_..."
EMAIL_FROM="Halley Producciones <cobros@tudominio.com>"
EMAIL_REPLY_TO="hola@halleyaudiovisual.com"
```

- **Hasta verificar un dominio en Resend**, el remitente de prueba
  `onboarding@resend.dev` sólo puede escribirle a la casilla con la que creaste la
  cuenta. Para mandarle a familias reales hay que verificar el dominio de Halley.
- **`EMAIL_REPLY_TO` es lo que hace que las respuestas lleguen.** El remitente
  suele ser una dirección del dominio verificado que no tiene casilla: si una
  familia responde ahí, la respuesta se pierde.
- **Para la demo conviene `bandeja`**: los emails de prueba van a direcciones
  inventadas y mandarlos de verdad sólo ensucia la reputación del dominio.

---

## Mudar la base de región

Supabase no permite cambiar la región de un proyecto: hay que crear uno nuevo
donde se lo quiere y llevar los datos.

```bash
# 1. Crear el proyecto nuevo y copiar el connection string del Session pooler.
# 2. Crear las tablas en el destino
DATABASE_URL="<destino>" npx prisma db push
# 3. Poner el destino en DATABASE_URL_DESTINO y mudar los datos
npm run db:migrar          # agregá --vaciar si el destino ya tiene algo
# 4. Recién ahora, reemplazar DATABASE_URL y DIRECT_URL
```

[`scripts/migrar-base.mjs`](scripts/migrar-base.mjs) lee de una base y escribe en
la otra en el mismo proceso, sin pasar por JSON: así los `Decimal` de los montos y
las fechas viajan como son. Inserta en orden de claves foráneas, se niega a
escribir sobre un destino con datos y al terminar compara los conteos.

---

## Guión de la demostración

Requiere las herramientas de demo activas (en local ya lo están).

1. **Panel → Grupos.** La tira de marcas muestra el estado de cobranza de un
   vistazo: tilde es al día, punteado con saldo, tachado con cuotas vencidas.
2. **Entrar a un grupo.** Arriba las métricas y el plan; abajo la tabla de
   alumnos, cada uno con una marca por cuota.
3. **Copiar el link de registro y abrirlo en otra pestaña.** Es lo que se le manda
   a las familias.
4. **Elegir un hijo y poner un email.** En demo el link de acceso se muestra en
   pantalla en vez de mandarse por mail.
5. **Abrir ese link:** entra al dashboard con el plan completo y la galería
   trabada.
6. **Simular la transferencia.** Registra el pago y dispara el webhook igual que
   lo haría Talo.
7. **Sin recargar:** la cuota pasa a tilde en el dashboard y en el panel al mismo
   tiempo, y **se destraba la galería**.
8. **Bandeja.** La invitación, el link de acceso, la confirmación a la familia y
   el aviso a Halley, con el texto exacto que se envía.
9. **Nuevo particular.** Una boda con seña y saldo, para mostrar el otro modo.
10. **Galerías → nueva.** Subir fotos, copiar el link y abrirlo: la contraseña, el
    visor y la descarga.

---

## Pendiente

- **Rotar las credenciales de Mercado Pago** que se compartieron por chat.
- Probar el ida y vuelta del OAuth y un cobro real: necesita el dominio público
  con la URL de redirección registrada. El contrato de la API ya está verificado.
- Pasar `TALO_MODE=real` con las credenciales rotadas (el KYC ya está hecho y el adaptador está verificado contra la API real).
- Verificación de firma del webhook de Talo (la de Mercado Pago ya está).
- Verificar el dominio de Halley en Resend y pasar `EMAIL_MODE=resend`.
- Cron de recordatorios (hoy se disparan a mano desde el panel).
- Subir a Next 16 en algún momento tranquilo: `npm audit` marca CVE de libvips vía
  sharp. **No son explotables acá** — `next/image` sólo recibe archivos de
  `public/` y no hay `remotePatterns`, así que sharp nunca procesa contenido
  subido.
- Decisión abierta: la galería se libera con `deuda <= 0` (mora incluida), no con
  "al día". Una familia puede estar al día y deber mora residual, y ahí la galería
  sigue trabada. Es coherente en todo el sistema; cambiarlo es una línea.
