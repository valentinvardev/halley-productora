# Cobrarle a 2.000 familias sin perseguir a ninguna

**Cliente:** Halley Audiovisual — productora de egresados, bodas y quince, Córdoba
**Hecho por:** SurCodia
**Cuándo:** construido en julio y agosto de 2026, en unas pocas semanas
**Estado:** integrado contra las APIs reales de cobro; entra en producción en los
próximos meses con el padrón completo
**Tamaño:** 166 archivos, ~21.900 líneas, 77 commits

---

## El problema

Halley filma egresados. Su operación son **27 colegios y cerca de 2.000
estudiantes**, y cada estudiante lleva su propio plan de cuotas mensuales, que
arranca dos o tres años antes del viaje.

Eso, en la práctica, es esto: cada mes hay que decirle a dos mil familias cuánto
deben, cobrarles por transferencia, mirar el extracto bancario, cruzar cada
depósito contra un apellido, anotarlo en una planilla, avisarle al que pagó,
perseguir al que no, y —cuando el plan termina— entregarle el material a la
familia correcta y a nadie más.

Nada de eso es difícil. Todo eso es imposible de sostener a mano sin equivocarse.
Y los errores no son parejos: cobrarle de menos a una familia es plata perdida,
cobrarle de más es un problema con un cliente, y entregarle el material a quien
todavía debe es perder el único instrumento de cobro que queda.

## Qué se construyó

Un sistema que cubre el ciclo entero, de la primera cuota a la entrega del
material:

| | |
|---|---|
| **Cobros** | Un grupo por colegio y promoción, con su plan de N cuotas. Los alumnos se cargan uno por uno o pegando una lista. |
| **Dos proveedores** | Talo (transferencia a un CVU propio por alumno) y Mercado Pago (Checkout Pro). Cada grupo se rutea a la cuenta que cobra. |
| **Cuentas por socio** | Cada socio de la productora tiene su cuenta; la plata de cada evento cae donde corresponde. La de Mercado Pago se vincula con un botón. |
| **La familia** | Un link personal sin login, o registro con email y dashboard. Ve su plan cuota por cuota, paga, y le llega la confirmación. |
| **Galerías** | El material se libera solo cuando el plan está saldado. Con permiso chequeado en el servidor, no escondiendo un botón. |
| **Vitrina** | La landing pública de la productora, con el portfolio por categoría y pedido de presupuesto por WhatsApp. |

## Las decisiones que lo sostienen

Tres, y las tres son sobre qué **no** hacer.

### El estado de las cuotas no se guarda

La tentación es una columna `pagada` por cuota. Es la fuente de todos los
desacuerdos: alguien paga de más, alguien paga dos cuotas juntas, alguien
transfiere un monto que no coincide con nada, y a partir de ahí el panel dice una
cosa y los pagos dicen otra.

Acá el estado se **deriva**: se toma todo lo pagado y se reparte sobre el plan, de
la cuota más vieja a la más nueva, con la mora incluida. Un pago parcial, uno de
más y dos cuotas juntas se acomodan solos, sin código para cada caso. Y el panel
no puede terminar diciendo algo distinto de lo que dicen los pagos, porque no
tiene dónde guardarlo.

La mora sale del mismo lugar: toda cuota vence el 20; el recargo es 0 hasta los
dos meses, 3% a los dos, sube parejo hasta 5% a los cinco y ahí se queda.

### Un cliente particular es un grupo de uno

Halley también cobra bodas y quince: un cliente, una seña, un saldo. No son
cuotas mensuales y no son un grupo.

Se modelaron igual: un grupo con un solo alumno. Con eso, las bodas heredan
gratis la imputación, los pagos, las galerías, el panel de la familia y los
avisos. Cero lógica nueva para el segundo tipo de negocio.

### Un aviso de pago no es un pago

Los webhooks de Talo y de Mercado Pago se tratan como lo que son: un aviso de que
algo pasó. Antes de registrar un peso, el sistema **vuelve a consultar el pago
contra la API del proveedor**, con su propio token. Un aviso inventado no puede
fabricar plata. Y todo es idempotente por referencia de pago, así que un aviso
repetido no cobra dos veces.

## Lo que sólo aparece integrando de verdad

La integración con Talo se escribió primero contra la documentación y después se
probó contra la API real. Los dos no coincidían. Cinco hallazgos, todos
silenciosos, todos encontrados antes de que tocaran a una familia:

1. **No hay API key fija.** La autenticación es un token de una hora que se
   intercambia por credenciales. El adaptador escrito contra la documentación
   habría dejado de funcionar a los sesenta minutos.

2. **Un `Content-Type` en un GET devuelve HTTP 500.** Enviarlo es lo que hace
   cualquier cliente HTTP por costumbre. Con ese encabezado puesto, *ninguna
   transferencia se habría podido confirmar nunca* — y el síntoma habría sido
   "el sistema no ve los pagos", que se investiga por el lado equivocado durante
   días.

3. **`amount` es el neto, no el bruto.** El campo que parece el monto ya tiene la
   comisión descontada. Leyéndolo, cada familia habría quedado debiendo la
   comisión de su propia transferencia: centavos por operación, dos mil familias,
   y una discusión por cada una.

4. **El alias se trunca a 20 caracteres.** Talo le antepone un prefijo al alias
   que uno le manda y corta el resto. Los alias construidos con nombre y apellido
   terminaban colisionando entre dos alumnos del mismo colegio — en un campo que
   Talo exige único. Se rehízo con un sufijo aleatorio.

5. **El CVU y el alias no vienen donde dice la documentación**, sino anidados un
   nivel más adentro.

Ninguno de los cinco se veía en una prueba con datos falsos. Los cinco se
arreglaron en el día.

## La auditoría de seguridad

Terminado el sistema, y antes de abrirlo al padrón completo, se hizo una revisión
de punta a punta. Encontró dos puertas abiertas que importaban de verdad, las dos
introducidas por herramientas de demostración que en algún momento fueron útiles:

- **Un simulador de pagos alcanzable desde afuera.** Estaba pensado para recorrer
  el flujo sin plata real, y quedaba habilitado con la configuración que estaba
  puesta en producción. Se verificó en vivo: era posible llevar una deuda a cero
  sin transferir un peso, y con eso abrir la galería privada de la familia.

- **Una vía de acceso que se conformaba con el email.** Según cómo estuviera
  configurado el entorno, alcanzaba con conocer una dirección de correo para
  entrar a la cuenta de una familia.

Las dos se cerraron detrás de **una sola función** que decide si las herramientas
de demostración están habilitadas, y que en producción responde que no salvo que
se la habilite explícitamente. Una sola puerta es auditable; diez condiciones
repartidas por el código no lo son.

La misma auditoría destapó, de paso, que la política de seguridad del navegador
—puesta por nosotros unos días antes— estaba bloqueando todas las subidas de
archivos. Nadie lo había notado porque el síntoma parecía otro: la vitrina vacía
se leía como "todavía no subimos nada".

**Defensas que quedaron puestas:** firma verificada en los webhooks de Mercado
Pago, credenciales que nunca salen del servidor (el panel ve los últimos cuatro
caracteres), material privado firmado con vencimiento corto y servido **nunca**
por CDN, freno de fuerza bruta en el panel, y una bitácora de eventos de pago que
en la primera transferencia real permitió señalar exactamente dónde se había
cortado.

## Por qué decimos que está hecho para dos mil

Es fácil escribir un sistema de cobros que funcione con veinte familias y se caiga
con dos mil. Lo que separa a uno del otro no es la infraestructura —dos mil filas
no son nada para una base de datos—, es el trabajo humano que queda por familia y
por mes. Si queda alguno, no escala: se multiplica por dos mil.

**Cada alumno tiene su propio CVU.** Es la decisión que define todo el resto.
Cuando una familia transfiere, el sistema sabe quién pagó porque pagó a *su*
cuenta — nadie cruza un extracto bancario contra un apellido. Conciliar dos mil
depósitos por mes a mano es imposible; acá no se concilia nada, porque el destino
ya identifica al pagador.

**El estado no se guarda, se calcula.** No existen dos mil por N filas de estado
que puedan desincronizarse con los pagos. No hay nada que reparar cuando alguien
paga de más, de menos o dos cuotas juntas.

**Los alumnos se cargan pegando la lista** del colegio, no de a uno.

**Los recordatorios y las confirmaciones salen solos.** El trabajo por familia y
por mes, en régimen, es cero.

Y la prueba más concreta: **buena parte de los bugs que buscamos eran bugs de
escala**, no de funcionamiento.

- El alias truncado a 20 caracteres colisiona recién cuando hay dos alumnos con
  nombres parecidos en el mismo colegio. Con veinticinco alumnos no aparece nunca.
  Con dos mil aparece la primera semana, en un campo que Talo exige único.
- Leer el neto en lugar del bruto son centavos por operación. Con treinta y
  cuatro pagos no se nota. Con dos mil familias son dos mil conversaciones sobre
  por qué su cuota nunca termina de saldarse.

Los dos se encontraron y se arreglaron antes de que llegara la escala que los
hace visibles. Ese es el sentido de haber integrado contra las APIs reales desde
temprano en vez de esperar a producción.

## Dónde está hoy

El sistema está terminado y desplegado, con los dos proveedores de pago
integrados contra sus APIs reales —no contra simulaciones— y validado con una
operación piloto: 7 grupos, 25 alumnos, 34 pagos procesados de punta a punta.

La entrada en producción con los 27 colegios está prevista para los próximos
meses, acompañando el calendario de cobro de la productora.

## Stack

Next.js (App Router) · TypeScript · tRPC · Prisma · Postgres en Supabase ·
S3 + CloudFront · Talo · Mercado Pago · Resend · desplegado con PM2 sobre Debian.

---

## Lo que nos llevamos

El sistema no es difícil por lo que hace. Es difícil por lo que no puede permitir:
que el panel y los pagos digan cosas distintas, que un aviso falso fabrique plata,
que el material salga antes de tiempo, que una comisión se cobre dos veces.

Casi todo eso se resolvió sacando cosas: sacando el estado guardado, sacando el
segundo modelo de datos, sacando las condiciones repartidas. Lo que quedó es
chico y se puede leer entero.

Y lo que no se resolvió leyendo documentación se resolvió llamando a la API de
verdad, temprano, con la plata todavía a salvo.
