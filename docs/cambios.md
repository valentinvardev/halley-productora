# Cambios

Bitácora de la lista de pedidos de agosto de 2026. Cada entrada dice cómo estaba
antes y cómo quedó, para poder revisar una decisión sin releer el código.

El número de punto es el de la lista original. Los commits llevan ese número en
el cuerpo del mensaje, así que se los encuentra con:

```
git log --grep="Punto 8"
```

---

## Punto 8. Modo noche por defecto

**Pedido:** "poner modo noche como predeterminado".

**Antes.** El tema no seguía la preferencia del sistema operativo sino el reloj:
oscuro entre las 19 y las 7, claro el resto del día. Además una pestaña que
quedaba abierta desde la tarde se oscurecía sola al cruzar las siete, porque un
intervalo revisaba la hora cada minuto. Quien tocaba el botón del tema salía de
esa regla para siempre en ese navegador.

**Ahora.** Quien no eligió nada ve el sitio oscuro, siempre. La elección manual
sigue funcionando igual y sigue guardada.

**Por qué.** La web es una pieza de marca antes que una herramienta. El trabajo
de Halley son fotos y videos, y sobre fondo oscuro se ven como en una sala de
proyección y no como en una hoja impresa. Dejar eso librado al reloj de cada
visitante significaba que la mitad de las visitas veía la versión que no
favorece al material.

**Lo que se fue con el cambio.** El intervalo que miraba la hora y la función
que preguntaba si el usuario ya había elegido, que existía sólo como guardia de
ese intervalo.

---

## Punto 6a. Los links del menú bajan en vez de saltar

**Pedido:** "que baje, y que no se teletransporte" al apretar Servicios, Cómo
trabajamos y Contacto.

**Antes.** Los tres links saltaban de golpe al ancla. Un salto instantáneo no se
lee como haber llegado a otra parte de la misma página sino como haber cargado
otra distinta: se pierde de dónde se venía y cuánto había en el medio.

**Ahora.** El navegador baja con animación hasta la sección.

**Detalle que hubo que resolver.** La cabecera es pegajosa y mide 80 píxeles, así
que al llegar el título de la sección quedaba escondido detrás de ella. Se le
puso un margen de scroll de 96 píxeles a los destinos. Va en los destinos y no en
el link para que valga igual si alguien entra con el ancla ya puesta en la URL.

**Accesibilidad.** Quien pidió menos movimiento en su sistema vuelve al salto
instantáneo, que es exactamente lo que pidió.

---

## Punto 6b. Desenfoque de movimiento

**Pedido:** "animación de transición con desenfoque de movimiento".

**Antes.** No existía.

**Ahora.** Mientras la página baja, el contenido se desenfoca dos píxeles y
recupera el foco al llegar.

**La limitación, dicha de frente.** El desenfoque de movimiento real, el que
promedia los cuadros intermedios, no existe en la web. Esto es una simulación.
Alcanza para que el ojo lea "esto se está moviendo" en lugar de "esto parpadeó",
pero no es lo mismo que el efecto de una cámara.

**Decisiones dentro del efecto.** Son dos píxeles y no más porque de más marea y
tapa el contenido en vez de acompañarlo. La vuelta al foco dura más que la ida,
así que la página se asienta en lugar de recuperar nitidez de golpe. La cabecera
no se desenfoca: es pegajosa, no se mueve respecto de la pantalla, y borronear
algo quieto sería mentir sobre lo que está pasando.

**Por qué va en un commit aparte del 6a.** Es la parte discutible del punto. La
landing tiene cuatro videos de fondo y un filtro sobre todo eso puede pesar en
máquinas modestas. Separado, se puede revertir sin perder el scroll suave, que es
lo que resuelve el problema que se reportó.

---

## Punto 2a. Reordenar las fotos de una categoría

**Pedido:** "habilitar la opción de mover las fotos de lugar, el orden".

**Antes.** El campo de orden existía en la base y la vitrina lo respetaba, pero
no había forma de cambiarlo. Lo único disponible era subir una pieza nueva, que
cae al final, o mandar una al frente de un salto con el botón de portada. Poner
la tercera antes que la segunda no se podía.

**Ahora.** Cada pieza muestra dos flechas al pasar el mouse y se mueve un lugar
por clic. Van abajo a la derecha porque arriba ya están el tilde de selección y
la estrella de portada, y tres controles en la misma esquina se tocan entre sí
con el dedo. El botón de portada sigue existiendo y hace otra cosa: salta hasta
la primera posición.

**El problema que apareció al verificar.** La primera versión intercambiaba el
número de orden entre la pieza y su vecina. Es lo barato: dos escrituras. Pero
simulándola contra la base de producción antes de dar nada por hecho, resultó que
no funciona con los datos reales. En la categoría de presupuesto las treinta y
una piezas tienen orden cero, porque se subieron antes de que el campo se usara
en serio. Con todo empatado no hay nada que intercambiar, y para correr una pieza
había que darle un número por debajo o por encima de todo el bloque, lo que no la
movía un lugar sino al principio o al final de la lista.

**La solución.** La operación renumera la categoría entera de 0 a N con las dos
piezas ya intercambiadas. Son cuarenta escrituras en el peor caso, dentro de una
transacción, en algo que hace una persona mirando una grilla: no es un camino
crítico. A cambio, el resultado es siempre exactamente un lugar, haya empates,
huecos o los números negativos que mete el botón de portada. Y deja la categoría
ordenada, así que el movimiento siguiente parte de datos sanos.

**Verificación.** Ocho casos simulados contra las cinco categorías reales, entre
empates totales, valores negativos y los dos bordes de la lista. En todos se
mueve un lugar, o no se mueve nada cuando corresponde.

**Lo que falta del punto 2.** La segunda mitad, la cuadrícula que acomode fotos
verticales y horizontales, necesita una decisión de diseño antes de escribirse.

---

## Puntos 4 y 5. Textos de la portada editables

**Pedido:** "permitirnos modificar el texto de la parte 'lo que no negociamos'" y
"permitirnos modificar el texto de 'contanos qué día es'".

**Antes.** Los dos bloques estaban escritos adentro del código de la portada. El
de "Lo que no negociamos" era una constante con cuatro pares de título y texto;
el de contacto, dos strings sueltos en el componente. Cambiar una coma pedía un
deploy.

**Ahora.** Los dos se editan desde el panel, en Textos, y salen sin esperar nada.

**Cómo funciona.** Cada bloque es un conjunto de campos con nombre. El panel los
pinta uno por uno y la página los lee y los acomoda en su maqueta. No hay HTML ni
estructura libre: lo que se edita son las palabras, así que desde el panel no se
puede romper el diseño, ni el orden, ni los botones.

**Lo que no se guarda cae al texto original.** Una instalación nueva muestra
exactamente lo mismo que hoy sin que nadie toque nada. Y vaciar un campo en el
panel equivale a restaurarlo: un campo en blanco quiere decir "no lo tocaron", no
"dejalo vacío", así que no se puede dejar un hueco en la página sin querer.
"Volver al original" borra la fila en lugar de copiar el valor de fábrica encima,
que es la diferencia que importa el día que el texto original cambie.

**Decisiones dentro del editor.** Un bloque a la vez con un desplegable arriba,
igual que el editor de mails: apilados serían una pared de campos donde no se ve
dónde termina uno y empieza el otro. Los bloques que no están elegidos quedan
montados y escondidos, así cambiar de sección para mirar otra no borra lo que
estabas escribiendo en la primera. El desplegable marca cuáles están editados.

**Por qué esto es más que dos textos.** Es la base de los puntos 7 y 16, que
piden lo mismo para toda la web y para el simulador. La maquinaria ya está: sumar
una sección nueva es agregar una entrada al catálogo y leerla donde va. Lo que
queda de esos dos puntos es inventario, no ingeniería.

**Lo que no verifiqué.** El guardado contra la base de producción, porque
escribir ahí cambiaría el texto del sitio en vivo. Verifiqué que la portada lee
del módulo nuevo y cae correctamente al texto de fábrica, y que la pantalla del
panel responde.

---

## Punto 3. El panel usa la pantalla entera

**Pedido:** "que la cuadrícula de contenido ocupe toda la pantalla y no sobren
bordes negros (pc)".

**Antes.** El contenedor del panel de administración cortaba en 1080 píxeles. En
un monitor de escritorio el sidebar ya se lleva su parte, así que la grilla de
contenidos quedaba encajonada en el medio con el fondo del panel visible a los
dos costados. Eso es lo que se veía como bordes.

**Ahora.** El contenedor no tiene tope de ancho. La grilla de fotos llega hasta
donde llega la pantalla.

**Por qué se puede sacar sin romper el resto.** Lo que necesita ancho corto no
dependía de ese tope: el encabezado de cada pantalla ya corta su bajada en 62
caracteres, los formularios traen su propio ancho y las tablas largas viven
adentro de su propio scroll horizontal. Por eso soltar el contenedor no estira
ninguna línea de texto.

---

## Punto 15. Símbolos en el detalle del presupuesto

**Pedido:** "al haberlo personalizado a tu gusto, que aparezca el precio final y
todos los ítems incluidos (con símbolos)".

**Antes.** El precio final y la lista de ítems ya estaban. Lo que faltaba eran
los símbolos: las coberturas llevaban un punto medio de viñeta, que decía "esto
cuelga de aquello" pero no decía qué era, y los momentos y complementos no
llevaban nada.

**Ahora.** Cada línea lleva el suyo: calendario para los momentos del día, imagen
para la cobertura de fotografía, reproducir para la de video, y un más para los
complementos, que es exactamente lo que son, algo que se suma sobre la cobertura.

**La decisión que importa.** El símbolo sale del rol de la línea dentro del plan,
no de su nombre. Una línea es un momento si alguna otra cuelga de ella; es una
cobertura si ella cuelga de otra; y si no es ninguna de las dos, es un
complemento. Eso lo dice la estructura del presupuesto. La alternativa era una
tabla de nombre a ícono, que se rompe en silencio el día que Halley carga un ítem
nuevo desde el panel: quedaría sin símbolo o con el equivocado y nadie se
enteraría hasta verlo en un presupuesto emitido.

**La única excepción** mira el nombre de la opción, y es la que hace falta: entre
las dos coberturas conviene distinguir foto de video de un vistazo, porque es
justamente lo que la persona vino eligiendo momento por momento.

---

## Punto 13. Sin resolver, y por qué

**Pedido:** "revisar el formato del panel 'mi panel' en pc, hay un espacio vacío
blanco".

**Lo que busqué.** Revisé la estructura de la pantalla buscando una causa
concreta: un contenedor con alto fijo, una grilla que dejara celdas huérfanas, un
bloque condicional que se ocultara dejando su espacio. No hay ninguna. La tira de
datos usa celdas flexibles que se estiran para llenar la fila, así que tampoco
deja huecos.

**Lo que queda como hipótesis.** El contenido está en una columna de 760 píxeles
centrada, así que en un monitor ancho quedan márgenes grandes a los costados.

**Por qué no lo cambié igual.** Ensanchar esa columna empeoraría lo que hay
adentro: el plan de cuotas son filas con el concepto a la izquierda y el monto a
la derecha, y a 1080 píxeles quedarían separados por un vacío largo que hace más
difícil leer qué monto corresponde a qué cuota. Es el caso opuesto al del punto
3, donde el ancho suma porque lo que se muestra son fotos.

**Qué necesito para resolverlo.** Una captura, o saber si el hueco aparece con
una sola familia o con varias. Con eso se resuelve en minutos y sin adivinar.

---

# Cómo revertir

Cada punto está en un commit propio, y el número de punto va en el cuerpo del
mensaje. Para encontrarlo:

```
git log --grep="Punto 6" --oneline
```

Ojo con uno: el commit de los puntos 4 y 5 los cierra juntos y dice "Puntos" en
plural, así que hay que buscarlo como `--grep="Puntos 4"`. La tabla de abajo es
el índice confiable; el grep es la comodidad.

Para deshacer un punto sin tocar los demás, `git revert` sobre su commit. Genera
un commit nuevo que deshace ese cambio, así que no reescribe historial y se puede
volver a aplicar después:

```
git revert 82a66e5        # deshace el desenfoque de movimiento
git revert --no-commit 82a66e5   # lo mismo, sin commitear, para revisarlo antes
```

## Tabla de puntos y commits

| Punto | Commit | Qué revierte |
|---|---|---|
| 8 | `5211221` | Vuelve al tema por hora del día |
| 6a | `b6452b0` | Vuelve al salto instantáneo en los links del menú |
| 6b | `82a66e5` | Saca el desenfoque, deja el scroll suave |
| 2a | `19a7db3` | Saca las flechas de reordenar fotos |
| 4 y 5 | `ce65dc0` | Los textos de la portada vuelven al código |
| 3 | `651fc35` | El panel vuelve a cortar en 1080 |
| 15 | `23fe7ad` | Saca los símbolos del detalle |
| 1 | `50d9d11` | Vuelve al rebobinado a saltos (los videos siguen recodificados) |
| edición sobre la página | `f62188c` | Los textos se siguen editando, pero sólo desde el panel |
| tema base nocturno | `3cf46d2` | Vuelve a la base clara, con el oscuro por sistema y por script |
| 2b | `d72b7f9` | La vitrina vuelve a la grilla de 4:3 y a recortar las verticales |
| 7 | `fbe6909` | El hero, el cometa y el encabezado de servicios vuelven al código |
| alineación de los botones | `fc6a011` | Las filas de montos vuelven a alinearse abajo |
| visor optimista | `bf19a41` | El visor vuelve a esperar la foto grande antes de mostrar algo |
| A | `acca85c` | Vuelve la portada grande a las páginas de servicio |
| B | `06102e3` | Las tarjetas vuelven a ser clickeables sólo en el botón |
| C | `6e2b8f3` | Los avisos vuelven a la variable de entorno |
| D y E | `1c285b9` | La fecha vuelve a ser obligatoria y se ofrecen todos los planes |
| G | `72c899e` | Vuelven las flechas de subir y bajar en todos lados |
| H | `f3b0022` | Las cuotas vuelven a tener sólo el tinte de fondo |
| F | `f8cea3c` | El presupuesto deja de guardarse a medias |
| I | `c3b61a0` | Vuelve el cuadro de película en el costado del acceso |
| J | `752dabe` | Las páginas de servicio vuelven al código, y las tarjetas con ellas |
| K | `cba99df` | Se van los corazones; la columna likes queda en la base sin uso |

## Los dos casos que necesitan un paso más

**Punto 6.** Son dos commits. Revirtiendo sólo `82a66e5` se va el desenfoque y
queda el scroll suave, que es lo que resuelve el problema reportado. Revertir los
dos deja todo como estaba.

**Puntos 4 y 5.** El commit devuelve los textos al código, pero si alguien ya
editó y guardó desde el panel, esas filas quedan en la tabla de ajustes sin que
nadie las lea. No molestan, pero para dejarlo limpio se borran las claves que
empiezan con `texto:`.

**C.** Revertirlo deja la clave `mailAvisos` guardada en la tabla de ajustes si
alguien la cargó. No molesta: el código vuelto atrás no la lee.

**Punto 7.** Mismo caso que los puntos 4 y 5: el commit devuelve esos textos al
código, pero si alguien ya editó y guardó, quedan filas en la tabla de ajustes que
nadie va a leer. No molestan. Para dejarlo limpio se borran las claves `texto:hero`,
`texto:concepto` y `texto:servicios`.

**Punto 2b.** Revertir el commit devuelve la grilla de 4:3, pero las columnas
`ancho` y `alto` quedan en la base con sus datos. No molestan: nadie las lee y
el esquema vuelve a mencionarlas apenas se rehaga el cambio. Para dejarlo
prolijo del todo hay que correr `npx prisma db push` después de revertir, que es
lo que las saca. Y si se revierte y se rehace, las fotos no se vuelven a medir
porque las medidas siguen ahí.

**Tema base nocturno.** Revertirlo devuelve las dos vías viejas, la preferencia
del sistema y el script, así que quien tenga el teléfono en claro vuelve a ver la
web blanca hasta que corra el JavaScript. Las elecciones guardadas en los
navegadores siguen valiendo en las dos versiones: la clave de `localStorage` y los
valores no cambiaron. Lo único que hay que mirar si se revierte es que el
`color-scheme` vuelve a colgar del atributo, que es el agujero que este cambio
tapó.

**Edición sobre la página.** Revertirla no toca ningún texto guardado. Lo único
que se va es la forma de editarlos tocándolos; la pantalla de Textos del panel
queda intacta y sigue editando los mismos campos. Es la revertida más barata de
la lista.

## Lo que no se revierte con git

**El reordenamiento de fotos (punto 2a)** deja la categoría renumerada de 0 a N
la primera vez que se mueve una pieza. Revertir el código saca las flechas, pero
el orden nuevo queda: es un dato, no código. No hay nada que arreglar, sólo
conviene saberlo.

---

## Punto 1. El rebobinado de las portadas, ahora fluido

**Pedido original:** "que tengan la animación invertida cuando el cursor pase a
otro lado, porque si no se ve como un corte muy en seco".

**Lo que en realidad pasaba.** La animación invertida ya existía: al sacar el
cursor el video volvía hacia atrás en vez de cortar. Lo que no funcionaba era
cómo volvía. Se trababa, y trabado se lee como roto.

**La causa, que no estaba en el código.** Los tres videos tenían **un solo
keyframe cada uno**. En un video comprimido, sólo los keyframes se pueden mostrar
de forma directa; el resto de los cuadros se reconstruyen a partir del anterior.
Con un único keyframe al principio, pedir el cuadro 80 obliga al navegador a
reconstruir los 80 anteriores. El rebobinado pide un cuadro distinto sesenta
veces por segundo, así que estaba pidiendo lo más caro posible al ritmo más
exigente posible.

**Qué se hizo con los videos.** Se recodificaron con un keyframe cada quince
cuadros. Ahora el peor caso es reconstruir catorce, no ochenta. El costo es
tamaño: los tres pasaron de 884 KB a 2,2 MB en conjunto, porque un keyframe pesa
bastante más que un cuadro intermedio. Es un costo aceptable acá porque los
videos no se bajan hasta que la tarjeta está por entrar en pantalla: quien nunca
scrollea hasta los servicios no paga nada.

**Verificación de calidad.** Los originales sin comprimir ya no existen, así que
la recodificación partió de los archivos comprimidos y podía degradar la imagen.
Se comparó un recorte al 100% del cuadro 60 de quince, que es el más difícil de
los tres por ser escena oscura con luces, y no se distingue del anterior.

**Qué se hizo con el código.** El rebobinado pedía un cuadro nuevo en cada cuadro
de pantalla, sin mirar si el navegador había terminado de servir el anterior.
Cuando no daba abasto los pedidos se encimaban: la imagen se quedaba clavada y
después pegaba un salto. Ahora cada paso espera a que el anterior haya terminado.
Si el navegador tarda, los pasos se hacen más largos pero siguen siendo parejos,
que es lo que el ojo lee como fluido. La velocidad la sigue marcando el reloj, así
que el retroceso dura lo mismo en una máquina rápida que en una lenta: lo que
cambia es en cuántos tramos se divide.

**Lo que sigue igual.** En el teléfono no rebobina, y es a propósito: la
animación se dispara al entrar en pantalla, y cuando la tarjeta sale no hay nadie
mirándola.

---

## Editar los textos tocándolos en la página

**Pedido:** "para editar el contenido de la landing se me viene a la cabeza
integrarles una feature de web builder, que esencialmente sea un sidebar para
cambiar aspectos importantes, pero más que nada cuando hacemos click en un
párrafo que en el sidebar nos aparezca para modificar el mismo".

**Antes.** Los textos de la portada ya se podían editar, pero desde una pantalla
aparte del panel. Para cambiar una frase había que acordarse de en qué sección de
la página estaba, encontrarla en un desplegable que la nombra con el nombre que
alguien le puso en un catálogo, y después volver a la portada a ver cómo quedó.

**Ahora.** Se entra a la portada con el modo prendido, se toca la frase, y el
panel de la derecha abre justo ese campo. Se escribe, se guarda, y el texto
cambia en la página misma.

**Por qué sobre la página de verdad y no sobre una vista previa.** Una vista
previa adentro del panel reintroduce la duda que venía a sacar, que es si lo que
se ve es lo que va a quedar. Acá no hay copia: es la portada, con sus fuentes, su
ancho real y el tema que tenga puesto el navegador. Si el título entra en dos
renglones, se ve entrando en dos renglones.

**Quién lo ve.** Hacen falta las dos cosas: ser administrador y pedirlo con
`?editar=1`. Sin la cookie no alcanza con escribir la dirección; sin el `?editar=1`
un administrador ve la portada igual que cualquiera, que es lo que hay que poder
hacer para revisar el sitio. Del panel, en Textos, sale un botón que ya lleva el
modo puesto.

**Qué cuesta cuando nadie está editando.** Nada. Los textos se marcan con un
atributo que sólo se agrega en modo edición, así que el HTML que recibe un
visitante es exactamente el de antes: ni un nodo de más, ni una clase de más. La
consulta de la cookie no agrega trabajo porque la portada ya se armaba en cada
visita, que es lo que le permite mostrar la vitrina actualizada.

**Detalles que se resolvieron en el camino.**

- El punteado que marca qué se puede tocar va por fuera del texto y no lo empuja,
  así que la página en modo edición mide exactamente lo mismo que la publicada. Un
  borde la correría unos píxeles y uno terminaría ajustando un texto contra una
  maqueta que no es la real.
- Un texto que quedó vacío no se podría tocar, porque no ocupa lugar. En modo
  edición se le reserva un hueco visible, que es justo cuando más falta hace poder
  entrar a escribirlo.
- El desenfoque que aparece al bajar por los links del menú deja afuera al editor.
  No es estética: desenfocar un elemento lo convierte en el marco de referencia de
  sus hijos fijos, así que la barra y el panel habrían dejado de estar fijos y se
  habrían ido con el scroll en medio de una edición.
- La cabecera del sitio es pegajosa y se pega arriba de todo. En modo edición se
  pega cuarenta píxeles más abajo, para no meterse debajo de la barra del editor.

**Lo que no cambió.** La pantalla de Textos del panel sigue estando y sigue
sirviendo, para repasar todo junto y para encontrar un texto cuando no se sabe en
qué parte de la página estaba. Son dos puertas a lo mismo: el almacenamiento es el
que ya existía, cada texto ya era un campo con nombre. Esto sólo agrega cómo
encontrarlo.

**Lo que esto habilita.** Los puntos 7 y 16 piden lo mismo para el resto de la web
y para el simulador. A medida que esos textos entren al catálogo, quedan editables
sobre la página sin escribir nada nuevo: alcanza con marcarlos.

**Lo que no verifiqué.** El guardado contra la base de producción, por lo mismo de
siempre: escribir ahí cambiaría el texto del sitio en vivo. El guardado usa la
misma llamada que la pantalla del panel, con el mismo contenido, y esa ya está en
uso. Verifiqué que la portada marca sus doce textos sólo en modo edición, que un
visitante sin la cookie no ve nada aunque escriba `?editar=1`, y que las reglas de
estilo del modo llegan a la hoja compilada.

---

## El tema base pasa a ser el nocturno

**Pedido:** "el theme base tiene que ser el nocturno, osea el oscuro".

**Antes.** El oscuro ya era lo que veía todo el mundo, pero no era la base: era
una corrección. La paleta escrita en el CSS era la clara, y el oscuro se aplicaba
por dos caminos que corrían en paralelo, la preferencia del sistema operativo y
un script que ponía un atributo en el HTML antes de pintar. Eso funcionaba en el
caso normal y fallaba en los bordes: sin JavaScript, con el script bloqueado, o
con `localStorage` tirando una excepción, alguien con el sistema en claro se
quedaba con la web blanca para siempre.

**Ahora.** La paleta escrita en el CSS es la nocturna. El claro quedó abajo, como
lo que hay que pedir con el botón. El HTML que manda el servidor ya viene oscuro,
sin esperar a que corra nada.

**Lo que se ve no cambió.** Y eso es a propósito. La portada renderizada con el
código nuevo salió idéntica, píxel por píxel, a la renderizada con el anterior:
lo que cambió es de dónde sale el oscuro, no cómo se ve. Quien ya estaba viendo
la web no se entera de nada.

**La preferencia del sistema deja de participar.** Antes, un teléfono configurado
en claro empujaba hacia la versión clara y el script lo corregía. Ahora el tema lo
decide la marca y punto: el trabajo de Halley son fotos y videos, y sobre papel
oscuro se ven como en una sala y no como en una hoja. El botón sigue estando para
quien prefiera el claro, y su elección se sigue guardando en ese navegador.

**Qué se dio vuelta.** No alcanzaba con cambiar nueve colores. El oscuro vivía
repartido en seis bloques condicionales, cada uno escrito dos veces (una por
preferencia del sistema y otra por el atributo). Los doce se reemplazaron por seis
pares limpios de base más excepción: los colores, el color-scheme, los tintes de
cuota saldada y vencida, los dos dibujos del logo, el sol y la luna del botón, la
paleta propia de la landing y el cometa.

**Un arreglo que apareció en el camino: los controles del navegador.** El
`color-scheme`, que es lo que le avisa al navegador de qué color dibujar los
desplegables, los checkboxes, el autorrelleno y la selección de texto, colgaba del
atributo. Como el atributo ahora sólo existe para quien tocó el botón, el resto se
habría quedado con la página pintada en oscuro y el navegador convencido de que es
clara, dibujando chapa clara encima de las pantallas negras. Ahora se declara en la
raíz, junto con los colores.

**Otro que apareció al imprimir.** El `color-scheme` se hereda, así que el oscuro
de la pantalla llegaba al papel: en un PDF de prueba los checkboxes salían como
cuadrados negros sobre la hoja blanca. El bloque de impresión ya declaraba que en
papel no hay tema, así que ahora también lo declara para lo que dibuja el
navegador y no el CSS.

**Por qué el PDF no se puso negro.** Es la parte que más fácil se rompía y la
razón por la que no se rompió merece quedar escrita. El bloque de impresión y la
vista de documento del panel están fuera de toda capa de CSS, y en la cascada lo
que no está en una capa le gana a lo que sí, sin siquiera mirar especificidad. Los
colores del tema están todos dentro de capas. Por eso la hoja sigue saliendo
blanca aunque la pantalla esté negra, y por eso el comentario del CSS avisa que
sacar una de esas reglas de su capa rompería el PDF en silencio.

**Lo único que sí cambia en el papel.** Los tintes de cuota saldada y vencida se
imprimen ahora con los valores del nocturno en vez de los del diurno. Son verde y
rojo muy tenues en los dos casos y sobre blanco quedan igual de pálidos; lo miré
impreso y se lee bien. No se agregó una regla para volver a los viejos porque la
diferencia no se percibe.

**Cómo se verificó.** Con Chrome sin interfaz, que en esta máquina reporta
preferencia clara, que es justamente el caso que antes fallaba:

- La portada por defecto sale oscura, y es byte por byte la misma imagen que salía
  antes del cambio.
- Un banco de pruebas estático, sin servidor ni JavaScript de por medio, sale
  oscuro sin el atributo y claro con él, con los controles del navegador siguiendo
  al tema en los dos casos.
- El PDF impreso se abrió y se le leyeron los colores uno por uno: papel blanco,
  tinta negra, bordes grises y nada del tema oscuro adentro.
- El panel y el simulador se miraron enteros.

**Lo que no se tocó.** Los mails, que arman su propio HTML y ya se declaran claros
por su cuenta. Y la vista de documento del panel, que fuerza la hoja blanca y
sigue haciéndolo igual.

---

## Punto 2b. La vitrina deja de recortar las fotos

**Pedido:** "quieren una galería como VSCO para las fotos verticales y
horizontales". Es la respuesta al punto que había quedado abierto esperando
justamente esta definición.

**Antes.** El portfolio de cada servicio era una grilla de casilleros iguales de
4:3, y cada foto entraba recortada al casillero. A una horizontal apenas se le
notaba. A una vertical le cortaba la cabeza y los pies, que en fotos de gente es
donde está la foto. Puestas una al lado de la otra no se distinguía cuál había
sido vertical: todas terminaban siendo la misma foto apaisada.

**Ahora.** La columna fija el ancho y cada foto se lleva el alto que le
corresponde por su forma. Nada se recorta.

**Por qué columnas y no una grilla.** Una grilla con piezas de alto distinto deja
agujeros al final de cada fila. Las columnas apilan sin huecos, que es lo que da
el aspecto compacto de VSCO. El costo es el orden de lectura: se lee bajando por
una columna y no cruzando la fila. Es el mismo trato que hace VSCO, y el orden
que se puso desde el panel se sigue respetando, empezando arriba a la izquierda.

**Dos columnas en el teléfono, tres en pantalla grande.** Antes era una sola
columna en el teléfono, o sea una foto por pantalla. Dos es lo que hace VSCO y lo
que deja recorrer el trabajo en vez de mirarlo de a una.

**El problema de fondo: había que saber la forma antes de tener la foto.** Sin
eso la columna arranca en cero y se estira a los tirones a medida que cada foto
llega, y la página salta bajo el dedo justo mientras alguien la está mirando. Por
eso ahora se guardan el ancho y el alto de cada pieza.

**Las fotos nuevas se miden solas al subirlas.** El navegador ya abre la imagen
para hacerle la miniatura, así que preguntarle cuánto mide no cuesta nada. Se
mide con la rotación del EXIF ya aplicada, que es lo que evita que una vertical
de teléfono entre registrada como horizontal.

**Las fotos que ya estaban se miden solas también.** La primera vez que alguien
abre una categoría, el servidor le lee el encabezado a las que no tengan medidas
y las guarda. Corre después de contestar, así que nadie espera por eso, y a la
segunda visita ya no hay nada que medir.

Se hizo así en vez de con un script de migración a propósito. Un script hay que
acordarse de correrlo, y de volver a correrlo el día que aparezca una pieza vieja
traída de otro lado. Esto se ocupa solo y no deja nada anotado en ninguna parte
que después haya que recordar.

**Cómo se le lee el tamaño a una foto sin bajarla.** Los formatos guardan el
ancho y el alto en los primeros bytes, antes de los píxeles, así que se pide sólo
el principio del archivo. Una foto de ocho megas cuesta lo que cuesta una de
cien kilobytes. Están cubiertos PNG, JPEG, WebP y GIF, que es todo lo que la
subida acepta y produce; AVIF queda afuera porque su contenedor obliga a recorrer
cajas anidadas, y una pieza sin medir no rompe nada, sólo no reserva su lugar.

No se usó una librería. `sharp` está en el árbol de dependencias porque lo
arrastra Next, pero este proyecto no la declara: apoyarse en eso es construir
sobre algo que un cambio de lockfile puede llevarse. Y son varios megas de
librería nativa para leer dos enteros.

**Un tope, que es un pasamanos y no una política.** Nada más alto que tres veces
su ancho. Una vertical de teléfono, una de cámara y una cuadrada pasan sin que se
les toque un píxel, que es todo el punto. Lo único que ataja es lo que no es una
foto: una captura de pantalla larga o un panorama girado, que sin tope se llevan
la columna entera y empujan al resto fuera de la vista.

**Lo que no cambió.** La galería de entrega a la familia sigue con su grilla de
cuadrados parejos, y es a propósito: ahí no se mira una vitrina, se busca una
foto puntual entre cientos, y para eso las celdas iguales dejan barrer con la
vista en línea recta. Los videos del portfolio también siguen en 16:9, que es la
forma que tienen.

**Cómo se verificó.** Con doce fotos de las dos orientaciones, la marcación real
de la galería y la hoja de estilos compilada del proyecto, mirando cuatro casos:
cómo se veía antes, cómo se ve ahora, cómo se ve en el teléfono y cómo se ve una
categoría cuyas piezas todavía no fueron medidas. El lector de encabezados se
probó contra los cuatro formatos, incluidas las tres variantes de WebP, y contra
tres imágenes del repo cuyas medidas ya se conocían por otro lado.

**Y contra la base de verdad.** Con las columnas ya aplicadas, las tres páginas
de servicio se abrieron una por una. La medición de fondo corrió sola y dejó las
noventa fotos medidas en la primera visita: veintiocho de bodas, cuarenta de
egresados y veintidós de quince. Los nueve videos del hero quedaron afuera, como
corresponde.

Ahí apareció el tamaño real del problema que se venía arrastrando: **veintiuna de
esas noventa fotos son verticales**, y a las veintiuna se les estaba cortando
cabeza y pies para meterlas en el casillero apaisado. Mirando la página de
egresados antes y después con las fotos reales se ve derecho: los retratos que
salían cortados a la altura de las piernas ahora salen enteros.

---

## Punto 7. El hero, el cometa y el encabezado de servicios, editables

**Pedido:** "en el web builder faltan varios campos de texto que sean editables,
desde el hero hasta cuatro tipos de día".

**Antes.** Se podían editar doce textos: los de "Lo que no negociamos" y los de
contacto. Todo lo que está arriba de eso seguía escrito en el código, o sea que
cambiar el eslogan de la portada pedía un deploy.

**Ahora.** Son veintiséis. Se sumaron tres secciones enteras: el hero, la del
cometa y el encabezado de los servicios.

**El titular del hero son tres campos y no uno.** Podría haber sido un solo texto
con saltos de línea, y estaría peor. El eslogan corta donde corta a propósito, y
en un campo único ese corte pasaría a depender de dónde termine la palabra y de
cuán ancha sea la pantalla. Además el tercer renglón se pinta distinto, que en un
campo único no se podría. Lo mismo con el título del cometa, que son dos
renglones y el segundo va en gris.

**También se pueden editar los dos botones del hero**, y el mensaje con el que se
abre el WhatsApp cuando alguien toca el primero.

**Ese mensaje destapó un hueco del editor.** No se ve en ninguna parte de la
página: vive adentro del link. Así que era un campo que existía en el catálogo y
no había forma de tocarlo sobre la página, sólo desde la pantalla del panel. El
editor sobre la página dejaba de ser una puerta completa.

Se resolvió listando, abajo del campo abierto, los demás campos de esa misma
sección. Se toca cualquier texto de la portada y desde ahí se llega a todos los
de su bloque, se vean o no. La lista se esconde mientras hay cambios sin guardar:
cambiar de campo desmonta el que estaba, y perder lo escrito por tocar un link es
la clase de cosa que hace desconfiar de un editor.

**Lo que sigue en el código.** El nombre y la línea de cada una de las cuatro
tarjetas. No es un olvido: esos textos los comparten la portada y la página de
cada categoría, y tienen que decir lo mismo en los dos lados, así que moverlos es
un trabajo aparte y no una entrada más en el catálogo.

**Cómo se verificó.** Manejando el editor de verdad desde el navegador, con la
cookie de administrador puesta: la portada marca sus veintiséis campos, tocar la
bajada del hero abre su campo, la lista de al lado ofrece los otros siete del
bloque, y tocar el del mensaje de WhatsApp lo abre con su texto adentro aunque no
se vea en la página. Escribiendo sin guardar, la lista se reemplaza por el aviso.
Un visitante sin la cookie sigue sin recibir un solo atributo de más.

Y se comparó el titular renderizado antes y después: los tres renglones ahora van
envueltos en etiquetas propias, que son de las que no cambian cómo se corta una
línea, y el estilo del titular no tiene ninguna regla que dependa de eso.

---

## Los botones que quedaban debajo de su campo

**Reportado con una captura:** el botón "Aplicar a todas" flotando más abajo que
el campo que le corresponde, sin llegar a tocarlo. Y la aclaración de que pasaba
en varios lugares.

**Por qué pasaba.** Un campo del panel son tres cosas apiladas: la etiqueta
arriba, el campo, y la nota abajo. Esas filas estaban alineadas por abajo, así
que el botón se ponía a la altura de lo último que hay en la columna, que es la
nota y no el campo. Un renglón más abajo.

Por eso pasaba en algunos y no en todos: los campos sin nota terminan en el
campo, y ahí alinear por abajo daba lo correcto. El desfasaje aparecía sólo donde
había una nota, que es justamente donde estaba la captura.

**Qué se cambió.** Esas filas ahora se alinean por el centro. El desfasaje pasó de
veintiséis píxeles a cero, y no por casualidad: la etiqueta de arriba y la nota de
abajo son del mismo cuerpo de letra, así que el centro de la columna cae justo en
el centro del campo. De yapa acomoda el bloque de la izquierda de cada fila de
cuota, que también estaba pegado abajo.

**Cuántos eran.** Tres filas, todas en la pantalla de montos de un alumno. Se
buscaron por todo el panel con un barrido que marca cualquier fila alineada por
abajo que tenga adentro un campo con nota, y después del arreglo el barrido no
encuentra ninguna.

**Cómo se verificó.** Antes de elegir se midieron las tres alternativas en el
navegador, con la hoja de estilos real, comparando el centro del botón contra el
centro del campo: alineado abajo daba 26 píxeles, centrado daba 0, y una tercera
opción con un espaciador invisible daba 2 pero desacomodaba el bloque de la
izquierda. Se eligió por la medición y no de ojo.

**Queda anotado en el código** por qué esas filas van centradas. Es de las cosas
que se "arreglan" de vuelta al revés si no está dicho.

---

## El visor deja de hacer esperar para pasar de foto

**Pedido:** "estaría tardando mucho el lightbox de la galería de los servicios en
cambiar a la siguiente foto rápido, no es optimista esa parte de la interfaz".

**Antes.** Al tocar la flecha cambiaba la dirección de la imagen y la pantalla se
quedaba con la foto anterior hasta que la nueva terminara de bajar: un pedido a
nuestro servidor, un redirigido a S3 y unos megas de archivo. El contador ya
decía el número nuevo mientras se seguía viendo la foto vieja, así que con el
dedo apurado se sentía trabado, como si el clic no hubiera entrado.

**Ahora.** Aparece al instante la miniatura, que ya está en el navegador porque
es la que se venía mirando en la grilla, y la foto grande entra encima cuando
llega. Además, mientras se mira una, se van bajando la anterior y la siguiente.

**Cuánto cambió.** Medido en el navegador, con la caché vacía y la red frenada a
algo parecido a un teléfono con mala señal, contando desde el clic hasta que se ve
la foto que se pidió:

| Paso | Antes | Ahora |
|---|---|---|
| primero | 16.117 ms | 9 ms |
| segundo | 4.432 ms | 7 ms |
| tercero | 5.716 ms | 5 ms |

**Primero la miniatura de la vecina, después la grande.** El adelanto empezó
pidiendo sólo las fotos grandes, y con eso el tercer paso todavía tardaba un
segundo y medio: era el caso donde la miniatura de esa foto tampoco estaba
bajada. La miniatura pesa unas cuarenta veces menos, así que pedirla primero es lo
que hace que el próximo paso se vea al instante; pedirla después la dejaba
esperando detrás de varios megas que en ese momento no hacían falta.

**Detalles que se resolvieron en el camino.**

- La miniatura es la que fija el tamaño de la caja, y la grande se acomoda encima.
  Va así porque la grande no mide nada hasta que baja, y una caja que crece cuando
  llega la foto es el mismo salto que se estaba tratando de sacar.
- La estructura es siempre la misma, esté cargada o no, y lo único que cambia son
  los estilos. Cambiar la estructura justo en el momento en que la foto llega es
  pedir un parpadeo.
- Una foto que ya estaba en el navegador puede terminar de cargar antes de que el
  código alcance a escuchar el aviso, y ahí el aviso no llega nunca y la foto se
  quedaría borrosa para siempre. Se pregunta por el estado del elemento en vez de
  confiar en haber llegado a tiempo.
- Volver a una foto ya vista no la muestra borrosa de nuevo: se recuerda cuáles ya
  bajaron. Desenfocar una foto que ya está en el navegador sería inventar una
  espera que no existe.

**Las piezas viejas sin miniatura** siguen esperando la grande, como siempre. No
hay nada que mostrar antes.

**Una medición que estuvo mal y se corrigió.** El primer intento preguntaba si
había algo pintado en el visor, y daba veinte milisegundos en las dos versiones.
Estaba midiendo mal: en la versión vieja la foto anterior sigue en pantalla, así
que siempre había algo pintado. Ese es justamente el defecto. La medición buena
pregunta si lo que se ve corresponde a la foto que se pidió. Y el primer par de
corridas compartió caché entre las dos versiones, lo que le regalaba a la vieja
todo lo que la nueva había bajado; se repitió con el navegador limpio cada vez.

---

## Segunda tanda: el plan hablado con Halley

Trece puntos, ordenados de chico a grande, un commit por punto salvo donde dos
se definen entre sí. Los primeros cinco:

### A. Las páginas de servicio pierden la portada grande

**Pedido:** las portadas grandes arriba de la galería tipo VSCO ocupan mucho
espacio, sacarlas.

**Qué cambió.** Se va el bloque de 21:9 entre el titular y la galería. La primera
pieza subida era esa portada y la galería arrancaba en la segunda; ahora todo lo
subido es galería. Sacar la portada sin ese cambio habría hecho desaparecer una
foto: bodas pasa de 27 en la galería a 28.

### B. Las tarjetas de servicio se clickean enteras y el botón acompaña

**Pedido:** que el hover de la portada prenda el botón a la vez, y cursor de
pointer para saber que se puede clickear.

**Qué cambió.** Un link estirado cubre la tarjeta entera, debajo del texto y los
botones, que siguen siendo suyos: el cursor avisa en cualquier parte de la foto y
tocarla entra. Y el botón "Ver" se prende con el hover de la tarjeta, no sólo con
el suyo: la tarjeta es el link y el botón es su etiqueta. El link estirado no
tiene nombre accesible ni parada de tabulador, porque el botón "Ver" ya es el
mismo destino con nombre y sería leerlo dos veces.

**Verificado** con el cursor de verdad sobre la tarjeta: el cursor es pointer y
el fondo del botón pasa a blanco.

### C. El email de avisos se configura desde el panel

**Pedido:** email para notificaciones de administración configurable en
settings, para gestionar dónde llegan los avisos de pago.

**Qué cambió.** Un campo "Email de avisos" en Ajustes. Reemplaza a la variable de
entorno como destinatario de "Pago recibido" y "Pago incompleto", que son los
únicos avisos que hoy le llegan a Halley. Es otra casilla que la de contacto a
propósito: la de contacto se publica en la web y le escribe cualquiera; ésta es a
la que quieren que les lleguen las cosas que pasan, y pueden no ser la misma
persona. Vacío cae a la variable de entorno, así que nada cambia hasta que lo
toquen.

### D y E. "Todavía no tengo fecha", y las cuotas según la fecha

**Pedido:** opción de no tengo fecha en el presupuesto. Y que la cantidad de
cuotas ofrecidas sea proporcional a la fecha del evento: si es en menos de nueve
meses, que no haya opción de nueve cuotas.

**Van juntos** porque uno define al otro: sin fecha hay que decidir qué cuotas se
ofrecen, y Halley decidió que sólo el pago único.

**La fecha.** El paso la exigía sí o sí, aunque fuera aproximada. Quien está
averiguando antes de tener salón no tiene ni aproximada, y lo que hacía era
inventar una para poder seguir, que es peor que ninguna: la hoja después dice una
fecha que nadie dijo. Ahora hay una casilla; al marcarla el campo se va (un campo
apagado con una fecha adentro sigue diciendo esa fecha), y el presupuesto sale con
la fecha a confirmar, que la hoja y el panel ya sabían mostrar.

**Las cuotas.** La última tiene que caer antes del evento: nadie va a estar
pagando la fiesta después de la fiesta. Con el evento a N meses enteros entran los
planes de hasta N cuotas, y el pago único entra siempre. Los meses van para
abajo: a dos meses y veinte días son dos, porque la tercera cuota no llegaría a
cobrarse. Una línea arriba de la lista explica por qué hay menos opciones, y si el
plan que estaba elegido queda afuera al cambiar la fecha, se pasa al más largo de
los que quedan.

**Cómo se verificó.** La regla vive junto a los planes, en datos, y se probó con
once casos borde (sin fecha, nueve meses justos, ocho meses y veintinueve días,
hoy, una fecha pasada, una fecha rota). En el navegador se recorrió el simulador
entero dos veces: marcando "no tengo fecha" llega al pago con la explicación y
sólo el pago único; eligiendo una fecha a cinco meses llega con la explicación
"con el evento a 5 meses" y el pago único a la vista. La segunda fila de esa
lista quedó debajo del pie fijo en la captura; que sea "3 cuotas" y nada más lo
sostienen la regla probada y que el plan elegido no era el pago único.

### G. Las fotos de la vitrina se reordenan arrastrando

**Pedido:** cambiar las flechas de subir y bajar por arrastrar y soltar.

**Qué cambió.** Con cursor, cada foto tiene un tirador abajo a la derecha: se
agarra, se lleva y se suelta. La que se lleva se atenúa y el lugar donde caería
se marca. Las flechas quedan sólo en pantallas táctiles, donde arrastrar con el
dedo tapa justo lo que se mueve y compite con el scroll; fue la decisión que
tomamos entre las dos opciones.

**Por qué eventos de puntero y no el arrastrar nativo.** El nativo ya lo usa la
zona de subida para recibir archivos, y los dos se pisarían. Y el tirador queda
fuera de la selección por rectángulo, que es lo que empieza al bajar el mouse en
cualquier otra parte de la grilla.

**La lista se acomoda apenas se suelta**, antes de que el servidor conteste.
Esperar la respuesta para ver la foto en su lugar es lo que hace que un arrastre
se sienta como si no hubiera entrado. Si el servidor rechaza, vuelve el orden
anterior.

**El servidor recibe la lista entera ya ordenada** y la numera de cero en
adelante. Describir el resultado y no "esta pieza va al lugar N" es lo que evita
que dos arrastres seguidos se pisen; si la categoría cambió en el medio, rechaza
entero.

**Y numera en una sola sentencia.** La primera versión hacía treinta
actualizaciones seguidas dentro de una transacción, y contra una base que está
lejos eso tardaba entre cinco y ocho segundos por arrastre. Ahora es un solo
UPDATE con la tabla de valores adentro, y tarda menos de un segundo. En el camino
apareció un problema del bundle de desarrollo: los helpers de SQL de Prisma y el
cliente salían de dos copias del módulo generado, y el fragmento llegaba a la
base como texto literal. Se resolvió armando la consulta con marcadores
numerados; cada valor viaja como parámetro, nada del usuario entra al SQL.

**Cómo se verificó.** Con el mouse de verdad sobre el panel: una foto llevada del
primer lugar al tercero aparece tercera en la base, y llevada de vuelta queda
como estaba, así que la vitrina real no cambió. Fingiendo un dispositivo sin
cursor aparecen las 28 flechas y ningún tirador. El UPDATE se probó además aparte
contra la base: toca las 28 filas en 368 milisegundos.

### H. Cada cuota lleva un rótulo de color

**Pedido:** colores que representen los estados de cuotas para los clientes,
como el de admin pero para usuarios.

**Lo que encontré.** El listado de cuotas ya era el mismo componente en el panel
y en la pantalla de la familia, con los mismos tintes verde y rojo. Pregunté qué
faltaba y la respuesta fue un rótulo por cuota.

**Qué cambió.** Cada fila lleva un rótulo con la palabra y el color: verde
"Pagada", rojo "Vencida", gris "Pendiente". Los tintes eran tenues a propósito,
y en el tema oscuro un tinte al trece por ciento es casi nada; el rótulo lo dice
sin depender de que el ojo distinga un fondo apenas verdoso de uno apenas rojizo.
La pendiente va con rótulo y no sin él: si sólo dos estados llevaran etiqueta, la
fila sin etiqueta se leería como "falta información".

**El verde entra al sistema como token**, con su valor para cada tema. Es la
segunda excepción al blanco y negro, por la misma razón que el rojo: el color
informa, no decora. Verificado en los dos temas con la hoja de estilos compilada.

### F. El presupuesto a medias se puede retomar

**Pedido:** un modal de "seguir armando" si la persona sale del armado, para
retomar por si salió sin querer.

**Qué cambió.** El armado se guarda en el navegador a medida que avanza, sin
botón: un "guardar borrador" que hay que apretar es justamente lo que nadie
aprieta antes de cerrar sin querer. Al volver al simulador, un modal pregunta si
se sigue con eso o se empieza de nuevo. Seguir restaura el evento, lo elegido,
los datos, la fecha, el plan y el paso.

**Tres límites a propósito.** Recién se guarda desde que hay algo elegido, porque
un borrador vacío no vale la pregunta. Caduca a la semana: uno de hace dos meses
es más molestia que ayuda. Y editar un presupuesto ya emitido por su código no
ofrece nada, porque ése ya tiene su página. Al generar el presupuesto, el
borrador se borra.

**Por qué en el navegador y no en el servidor.** Hasta el paso tres no hay nadie
del otro lado: no se pidió nombre ni mail. No hay a quién atarle un borrador.

**Cómo se verificó.** En el navegador: se eligió un momento con su cobertura, se
pasó al paso siguiente, se fue a la portada y se volvió. El modal apareció,
"seguir" dejó el wizard en el paso guardado y un paso atrás mostró el momento y
la cobertura marcados; "empezar de nuevo" limpió el borrador y la visita
siguiente no preguntó nada.

### I. El costado de las pantallas de acceso, con fotos reales en cubos

**Pedido:** el slider de fotos a la derecha del login está en blanco; que sea un
mosaico de fotos que cambian, idealmente cubos 3D rotando, solo para computadora.
Y la portada de la pantalla de ingreso de eventos con un collage transicionando.
Son el mismo componente: el marco de acceso lo comparten el login, el registro y
la página de cada grupo.

**Antes.** Diapositivas con un cuadro de película dibujado como marcador,
esperando que alguien dejara archivos en una carpeta. Nunca pasó.

**Ahora.** Nueve cubos en tres por tres, con una foto en cada una de sus cuatro
caras, que giran de a uno para cambiar de foto. Se alimentan solos de la vitrina:
seis de egresados, seis de bodas y seis de quince, entremezcladas. Gira uno cada
dos segundos y no todos juntos, que sería una máquina tragamonedas. Con el cursor
encima se detiene, y quien pidió menos movimiento lo ve quieto. En el teléfono
sigue oculto, como estaba.

**La consulta es pública** porque las pantallas de acceso son públicas. No expone
nada nuevo: son las mismas fotos y las mismas direcciones que la portada muestra
a cualquiera, y sólo miniaturas.

**Un detalle de geometría que apareció al mirarlo.** La primera versión no
mostraba las líneas de la grilla: la cara de adelante de cada cubo estaba
empujada hacia el ojo y la perspectiva la dibujaba un nueve por ciento más
grande, pisando a las vecinas. El cubo va ahora retraído esa misma distancia,
así la cara de adelante queda en el plano de la celda.

**Cómo se verificó.** Nueve cubos, treinta y seis caras con foto, dieciocho fotos
distintas y ninguna rota; un cubo giró dentro de los cinco segundos; y una
captura a mitad de giro muestra las dos caras a la vista y las líneas de la
grilla entre celdas.

### J. Las páginas de servicio se editan tocándolas

**Pedido:** el mismo web builder de la portada para las páginas de servicio, y
editar el contenido de la página de servicios.

**Qué cambió.** Cada página de servicio tiene su bloque en el catálogo: nombre,
línea, titular, entrada, las cuatro cosas que incluye con título y texto, y la
aclaración. Con `?editar=1` y la cookie de administrador se tocan y se cambian
igual que en la portada; sin eso el HTML es el de siempre.

**Lo que se destrabó de paso.** El nombre y la línea de cada servicio habían
quedado en el código en el punto 7, porque los comparten la portada y la página
de cada categoría y tenían que decir lo mismo en los dos lados. Ahora los dos
lados leen el mismo bloque: se cambia una vez y se ve en los dos. El mensaje de
WhatsApp de la página usa el nombre editado también.

**Los cuatro bloques se arman con una función y no a mano**, para que tengan
exactamente los mismos campos: es lo que deja que la página los lea sin
preguntar de cuál se trata. Y salir del modo edición vuelve a la página en la
que se estaba, no a la portada.

**Cómo se verificó.** Con la cookie de administrador, la página de bodas marca
sus doce campos y muestra la barra del editor; sin la cookie, cero marcas. La
portada marca ahora también el nombre y la línea de las cuatro tarjetas:
treinta y cuatro campos en total.

### K. Un corazón con contador en cada foto

**Pedido:** contador de likes para las galerías, sin sesión, que suba con cada
toque al corazón, asegurado con rate limiting para que no se pueda explotar.

**Qué cambió.** Un corazón chico abajo a la izquierda de cada foto del
portfolio, siempre a la vista, con la cuenta al lado. Se toca y sube. El número
sube apenas se toca y el servidor confirma después; esperar la respuesta para
moverlo es lo que hace sentir que el toque no entró.

**El corazón deja de significar dos cosas.** Elegir fotos para el presupuesto
usaba también un corazón. Decidimos entre las opciones que el corazón sea el
like público y que elegir marque con un tilde.

**El freno.** Es un contador público y anónimo, así que la única defensa contra
un bucle que lo infle es el freno por origen: treinta likes por minuto por IP, y
un solo like por foto por IP por hora. Ninguno es infranqueable (una red de
teléfonos comparte IP; un atacante puede rotarla), pero suben el costo de hacer
trampa muy por encima de lo que vale un número en una vitrina. Si el freno lo
para, el servidor devuelve la cuenta sin tocar y la pantalla la corrige. Además
el navegador recuerda qué fotos ya likeó, que es lo que evita el doble toque
accidental y deja el corazón pintado al volver.

**Cómo se verificó**, contra el servidor y la base de verdad: un toque suma uno
en pantalla y en la base y no abre el visor; el segundo toque no suma; treinta y
un pedidos seguidos a fotos distintas desde la misma IP cuentan treinta y
frenan el resto; volver a intentar con las mismas fotos frena los treinta y uno.
Los likes de prueba se devolvieron a cero: ninguna foto quedó con un número que
nadie le dio.

**En el camino.** La columna nueva pidió regenerar el cliente de la base, y el
archivo del motor estaba tomado por tres servidores de desarrollo que habían
quedado zombis de corridas anteriores, que además tenían agotadas las quince
conexiones del pool. Se mataron sólo esos tres, identificados por su línea de
comando, sin tocar los procesos de otros proyectos.
