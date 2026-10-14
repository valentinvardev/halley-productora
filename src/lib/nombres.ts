/**
 * Comparar nombres de alumnos para detectar al mismo cargado dos veces.
 *
 * Hace falta porque dar de alta es idempotente por nombre exacto, y "exacto" no
 * alcanza contra listas escritas a mano: "Araceli Merlo" y "Merlo Araceli" son
 * dos cadenas distintas y entraron las dos, con dos planes de cuotas y dos
 * invitaciones a la misma familia.
 *
 * No vive en `server/` a propósito: la comparación la hace la pantalla antes de
 * mandar nada, así el aviso sale sin ir y volver al servidor, y la misma regla
 * queda disponible del lado del servidor el día que haga falta.
 */

/* --------------------------------------------------- el pegado en bloque */

/**
 * Parsea el pegado en bloque: un alumno por línea, opcionalmente con el email
 * de contacto de la familia.
 *
 * Vive acá y no en `server/` porque la pantalla necesita las mismas filas que
 * va a crear el servidor para poder avisar de los repetidos antes de mandarlas.
 * Dos parsers que tienen que coincidir terminan no coincidiendo.
 */
export function parsearAlumnos(texto: string) {
  const filas: { nombre: string; emailContacto?: string }[] = [];
  const errores: string[] = [];

  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (!limpia) continue;

    const partes = limpia.split(/[,;\t]/).map((p) => p.trim());
    const nombre = partes[0] ?? "";
    const email = partes[1] ?? "";

    if (!nombre) {
      errores.push(limpia);
      continue;
    }
    if (email && !email.includes("@")) {
      errores.push(limpia);
      continue;
    }

    filas.push({ nombre, emailContacto: email || undefined });
  }

  return { filas, errores };
}

/* ------------------------------------------------- comparación de nombres */

/**
 * Las palabras del nombre, sin acentos, sin mayúsculas y sin puntuación.
 *
 * Se devuelven sueltas y no como una cadena porque el orden no importa: en una
 * lista de curso conviven "Apellido Nombre" y "Nombre Apellido" según quién la
 * escribió, y son la misma persona.
 */
export function palabrasDeNombre(nombre: string): string[] {
  return nombre
    .normalize("NFD")
    // Saca los diacríticos que la descomposición dejó sueltos. La eñe queda
    // como ene, que es lo que se quiere: "Muñoz" y "Munoz" son el mismo.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Cuánto se parecen dos nombres, o `null` si no se parecen en nada. */
export type Parecido = "igual" | "contenido";

/**
 * Si dos nombres parecen la misma persona.
 *
 * Dos niveles, y ninguno de los dos es "comparten el apellido":
 *
 * - `igual`: las mismas palabras en cualquier orden. "Araceli Merlo" y "Merlo
 *   Araceli".
 * - `contenido`: todas las palabras del más corto están en el más largo, y el
 *   más corto tiene al menos dos. "Bertaina Emilia" dentro de "Bertaina María
 *   Emilia".
 *
 * El mínimo de dos palabras es lo que evita que el aviso salte con cada
 * hermano. "Luna Delfina" y "Luna Tamara" comparten el apellido y no son la
 * misma persona; "Nicolás David Muñoz" y "Nicolás Olmos" comparten el nombre y
 * tampoco. Un aviso que salta siempre se aprende a ignorar, y ahí deja de
 * servir para el caso en que sí importa.
 */
export function parecidoEntreNombres(a: string, b: string): Parecido | null {
  const pa = palabrasDeNombre(a);
  const pb = palabrasDeNombre(b);
  if (pa.length === 0 || pb.length === 0) return null;

  const sa = [...pa].sort();
  const sb = [...pb].sort();
  if (sa.length === sb.length && sa.every((p, i) => p === sb[i])) return "igual";

  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (corto.length < 2) return null;

  // Se cuenta con repeticiones: un nombre con la misma palabra dos veces no
  // queda "contenido" en otro que la tiene una sola.
  const quedan = [...largo];
  for (const palabra of corto) {
    const i = quedan.indexOf(palabra);
    if (i === -1) return null;
    quedan.splice(i, 1);
  }
  return "contenido";
}

/** Un alumno ya cargado, con lo mínimo para poder mostrarlo en el aviso. */
export type Candidato = {
  id: string;
  nombre: string;
  emailContacto?: string | null;
};

/**
 * Los que ya están cargados y podrían ser esta misma persona.
 *
 * El email no dispara el aviso por su cuenta: los hermanos comparten casilla y
 * saltaría en todos. Sí se informa cuando además el nombre se parece, porque
 * ahí deja de ser una sospecha y pasa a ser casi seguro.
 */
export function buscarParecidos<T extends Candidato>(
  nombre: string,
  email: string | null | undefined,
  existentes: T[],
): { alumno: T; parecido: Parecido; mismoEmail: boolean }[] {
  const limpio = email?.trim().toLowerCase() || null;

  return existentes
    .map((alumno) => {
      const parecido = parecidoEntreNombres(nombre, alumno.nombre);
      if (!parecido) return null;
      return {
        alumno,
        parecido,
        mismoEmail:
          !!limpio && (alumno.emailContacto?.trim().toLowerCase() ?? null) === limpio,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
