# API para dar de alta alumnos

Para conectar un bot (el de WhatsApp) con el panel de Halley. Hace lo mismo que
el botón **Agregar alumno** dentro de un curso: crea al alumno con su CVU y le
manda a la familia la invitación por correo para registrarse.

Son dos pedidos:

1. `GET /api/v1/cursos`: los cursos en los que se puede dar de alta.
2. `POST /api/v1/alumnos`: el alta.

Dirección base: `https://halleyaudiovisual.com`

---

## La clave

Cada pedido lleva la clave en el encabezado `Authorization`:

```
Authorization: Bearer hly_...
```

Se genera en el panel, en **Ajustes > Conexión para bots**. Se muestra una sola
vez, así que hay que copiarla en ese momento y guardarla en el bot como un
secreto, nunca en un mensaje ni en el código. Hay una sola clave a la vez:
generar otra corta la anterior en el momento, y **Revocar** deja la API cerrada.
Si se pierde o se sospecha que se filtró, se genera otra.

Sin clave o con una que no es la vigente, la respuesta es `401`. Muchos
intentos con claves malas desde la misma IP dan `429` por un rato.

---

## 1. Los cursos

```
GET /api/v1/cursos
```

```json
{
  "cursos": [
    {
      "id": "cmf3k2...",
      "colegio": "Monserrat 2027",
      "curso": "6TO F",
      "etiqueta": "Monserrat 2027 · 6TO F",
      "prueba": false
    },
    {
      "id": "cmf9x1...",
      "colegio": "Mark Twain 2027",
      "curso": "Mark Twain",
      "etiqueta": "Mark Twain 2027 · Mark Twain",
      "prueba": false
    }
  ]
}
```

Salen los cursos de egresados que tienen el registro abierto y una cuenta que
cobra: los mismos en los que una familia se puede registrar sola por el link.
Si Halley cierra el registro de un curso, deja de aparecer.

**El bot no tiene que adivinar el curso.** La familia escribe "Monserrat, 6to F"
o "el Monse, la F" y el bot busca en esta lista, le muestra a la familia la
`etiqueta` del que encontró y le pide que confirme. El `id` que viaja en el
alta tiene que salir siempre de esta lista. En algunos colegios cada división
es un curso aparte (Monserrat, Manuel Belgrano); en otros todo el colegio es un
solo curso. La lista ya lo refleja.

La lista cambia poco, pero cambia (cursos nuevos, registros que se cierran).
Conviene pedirla al empezar cada conversación, o guardarla unos minutos como
mucho.

**Cursos de prueba.** Con `GET /api/v1/cursos?prueba=1` aparecen también los
cursos marcados de prueba en el panel, con `"prueba": true`. Sirven para
ensayar la conexión: el alumno se crea con un CVU simulado y no se cobra nada
de verdad. No se le tienen que mostrar a una familia.

---

## 2. El alta

```
POST /api/v1/alumnos
Content-Type: application/json
```

```json
{
  "cursoId": "cmf3k2...",
  "nombre": "Martina López",
  "email": "familia.lopez@gmail.com"
}
```

| Campo | Obligatorio | Qué es |
|---|---|---|
| `cursoId` | sí | El `id` de un curso de la lista |
| `nombre` | sí | Nombre y apellido del alumno, en cualquier orden. Si viene todo en minúscula se guarda con mayúscula inicial |
| `email` | sí | El correo de la familia. Ahí va la invitación |
| `forzar` | no | `true` para crear aunque haya un nombre parecido en el curso. Sólo después de preguntarle a la familia |
| `confirmarEmail` | no | `true` para usar el email aunque parezca mal escrito. Sólo después de preguntarle a la familia |

**El bot confirma el registro a la familia sólo con `201` o `200`.** Cualquier
otra respuesta es que no se hizo nada, y el campo `mensaje` dice por qué, en
castellano y listo para leer.

### `201`: creado

```json
{
  "estado": "creado",
  "mensaje": "Martina López quedó dado de alta en Monserrat 2027 · 6TO F.",
  "alumno": { "id": "a1b2...", "nombre": "Martina López" },
  "curso": { "id": "cmf3k2...", "colegio": "Monserrat 2027", "curso": "6TO F" },
  "invitacion": { "estado": "enviada", "destinatario": "familia.lopez@gmail.com" },
  "linkRegistro": "https://halleyaudiovisual.com/g/monserrat-6to-f?alumno=a1b2...",
  "moraPerdonada": [1, 2]
}
```

- `invitacion.estado` es `enviada`, o `no_salio` con un `motivo` (por ejemplo,
  esa familia marcó un correo de Halley como spam). El alta quedó hecha igual.
- `linkRegistro` es el mismo link que trae la invitación. El bot lo puede
  mandar por WhatsApp para que la familia no tenga que buscar el correo.
- `moraPerdonada`: las cuotas que ya estaban vencidas al momento del alta. No
  se les cobra recargo, porque venció cuando el alumno todavía no existía en el
  sistema. Halley lo puede cambiar después desde la ficha del alumno.

### `200`: ya estaba

```json
{
  "estado": "ya_estaba",
  "mensaje": "Martina López ya estaba cargado en el curso.",
  "alumno": { "id": "a1b2...", "nombre": "Martina López" },
  "curso": { "id": "cmf3k2...", "colegio": "Monserrat 2027", "curso": "6TO F" },
  "responsables": 0,
  "lugaresLibres": 3,
  "invitacion": { "estado": "enviada", "destinatario": "familia.lopez@gmail.com" },
  "linkRegistro": "https://halleyaudiovisual.com/g/monserrat-6to-f?alumno=a1b2..."
}
```

**No duplica.** Si en el curso ya hay un alumno con el mismo nombre (sin
importar el orden, las mayúsculas ni los acentos: "LOPEZ MARTINA" es "Martina
López"), no se crea otro. Qué pasa con la invitación depende de lo que ya
había:

| `invitacion` | Cuándo |
|---|---|
| `enviada` | Estaba cargado sin email y sin nadie registrado (Halley cargó la lista del colegio). El email que trajo el bot queda guardado y sale la invitación |
| `no_corresponde`, motivo `ya_tenia_este_email` | Ya tenía este mismo email. Es lo que pasa cuando el bot reintenta un pedido: se contesta igual y no se manda otro correo |
| `no_corresponde`, motivo `ya_tiene_otro_email` | Halley lo cargó con otro email. No se pisa, para no desviar los recordatorios a otra casilla |
| `no_corresponde`, motivo `ya_tiene_responsables` | Alguien de la familia ya se registró |

En los dos últimos casos el bot puede mandarle a la familia el `linkRegistro`:
con él se suma como otro responsable, si quedan `lugaresLibres` (hasta 3 por
alumno).

### Reintentar es seguro

Mandar dos veces el mismo pedido no crea dos alumnos ni manda dos correos: la
segunda vez contesta `200` con `ya_tenia_este_email`. Si el bot no recibió
respuesta (se cortó la conexión, pasó el tiempo de espera), tiene que volver a
mandar lo mismo y no dar el alta por hecha ni por fallida. Dos pedidos iguales
que llegan al mismo tiempo también terminan en un solo alumno.

Crear el CVU tarda unos segundos. Conviene esperar la respuesta hasta 30
segundos antes de reintentar.

---

## Cuando algo no va

Todas las respuestas de error tienen la misma forma:

```json
{ "error": "posible_repetido", "mensaje": "En el curso ya hay un nombre muy parecido. ..." }
```

| Código | `error` | Qué hacer |
|---|---|---|
| 400 | `nombre_incompleto` | Falta el apellido o el nombre. Volver a preguntar |
| 400 | `datos_invalidos` | Falta un campo o vino mal (`campos` dice cuáles) |
| 400 | `json_invalido` | El cuerpo no es JSON |
| 401 | `clave_invalida`, `sin_clave` | Falta la clave, no es la vigente o no hay ninguna generada |
| 404 | `curso_no_encontrado` | El `cursoId` no es de la lista. Volver a pedir la lista |
| 409 | `curso_cerrado` | Halley cerró el registro del curso. La familia tiene que hablar con Halley |
| 409 | `posible_repetido` | Ver abajo |
| 422 | `email_no_recibe` | El dominio del email no existe. Si hay `sugerencia`, preguntar si quiso decir eso |
| 422 | `email_dudoso` | El email parece mal escrito (`gmial.com`, `hotmal.com`). Ver abajo |
| 422 | `email_rebota` | A ese email ya se le escribió y el correo volvió. Pedir otro |
| 429 | `cupo_de_altas` | Más de 60 altas nuevas en la última hora. Es un freno contra un bot que se descontrola. Esperar y reintentar |
| 429 | `demasiados_intentos` | Muchas claves malas desde la misma IP. Esperar |
| 502 | `no_se_pudo_crear` | Falló la creación del CVU. No quedó nada a medias: se puede reintentar |
| 503 | `curso_sin_cuenta` | El curso no tiene cuenta que cobre. Lo tiene que resolver Halley en el panel |
| 500 | `error_interno` | Algo falló de este lado. Reintentar con los mismos datos, que no duplica |

### `posible_repetido`

Pasa cuando el nombre se parece a uno que ya está, sin ser igual. Por ejemplo,
la familia escribió "Juan Pérez" y en el curso está "Pérez Juan Ignacio":

```json
{
  "error": "posible_repetido",
  "mensaje": "En el curso ya hay un nombre muy parecido. ...",
  "candidatos": [{ "id": "c3d4...", "nombre": "Pérez Juan Ignacio" }]
}
```

El bot le pregunta a la familia: "¿Es Pérez Juan Ignacio?"

- **Si es él:** se manda otra vez con el nombre exacto del candidato
  (`"nombre": "Pérez Juan Ignacio"`), y la respuesta es `200 ya_estaba`.
- **Si no es él:** se manda otra vez igual que antes, con `"forzar": true`.

Hermanos con el mismo apellido no disparan esto: "Luna Delfina" y "Luna Tamara"
pasan sin preguntar.

### `email_dudoso`

```json
{
  "error": "email_dudoso",
  "mensaje": "familia@gmial.com parece mal escrito. ¿Quisiste decir familia@gmail.com? ...",
  "sugerencia": "familia@gmail.com"
}
```

El bot pregunta "¿Quisiste decir familia@gmail.com?":

- **Si sí:** se manda con el email corregido.
- **Si no, el que escribió está bien:** se manda igual, con `"confirmarEmail": true`.

Esto importa más de lo que parece: un correo a una dirección mal escrita rebota,
y cada rebote le resta reputación al dominio de Halley y empuja el resto de los
correos a spam.

---

## El recorrido del bot, de punta a punta

1. Pedir `GET /api/v1/cursos`.
2. Preguntarle a la familia el colegio y la división, encontrar el curso en la
   lista y confirmarlo con ella mostrando la `etiqueta`.
3. Preguntar nombre y apellido del alumno, y el correo de la familia.
4. Mandar `POST /api/v1/alumnos`.
5. Según la respuesta:
   - `201`: "Listo, ya está dado de alta. Te mandamos un correo para crear tu
     cuenta." Se puede sumar el `linkRegistro`.
   - `200`: depende de `invitacion` (ver la tabla de arriba).
   - `409 posible_repetido` o `422 email_dudoso`: preguntar y volver al paso 4.
   - `422` de email: pedir el correo de nuevo y volver al paso 4.
   - Cualquier otra cosa: no confirmar nada. Leer `mensaje`, y si no se
     resuelve, derivar a una persona de Halley.

## Ejemplo con curl

```bash
curl https://halleyaudiovisual.com/api/v1/cursos \
  -H "Authorization: Bearer $HALLEY_CLAVE"

curl -X POST https://halleyaudiovisual.com/api/v1/alumnos \
  -H "Authorization: Bearer $HALLEY_CLAVE" \
  -H "Content-Type: application/json" \
  -d '{"cursoId":"cmf3k2...","nombre":"Martina López","email":"familia.lopez@gmail.com"}'
```

## Lo que la API no hace

- **No crea cursos.** Si el colegio de la familia no está en la lista, el alta
  la tiene que hacer Halley.
- **No registra a la familia.** Da de alta al alumno y le manda a la familia el
  link para crear su cuenta, igual que el botón del panel. La cuenta la crea la
  familia.
- **No se llama desde un navegador.** La clave da de alta alumnos: va sólo en
  el servidor del bot.
