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
