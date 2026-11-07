import "server-only";

import { Resolver } from "node:dns/promises";

import { db } from "./db";
import { dominioRecibe } from "./entrega";

/**
 * Lo que se le pregunta al DNS para saber si el correo de Halley está bien
 * armado, y la lista de direcciones de familias que no pueden recibir.
 *
 * Todo sale del DNS público y no del panel de Resend a propósito: Resend dice
 * si un registro está, pero no si hay uno de más. En noviembre de 2026 había
 * dos claves DKIM distintas publicadas en `resend._domainkey`, Resend marcaba
 * el dominio como verificado, y quien recibe el correo toma cualquiera de las
 * dos: con la equivocada, la firma no verifica.
 */

const resolvedor = new Resolver({ timeout: 2500, tries: 2 });

/** Los TXT de un nombre, con los pedazos de cada registro ya unidos. */
export async function txt(nombre: string): Promise<string[] | null> {
  try {
    return (await resolvedor.resolveTxt(nombre)).map((partes) =>
      partes.join(""),
    );
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    return codigo === "ENOTFOUND" || codigo === "ENODATA" ? [] : null;
  }
}

export async function mx(nombre: string): Promise<string[] | null> {
  try {
    return (await resolvedor.resolveMx(nombre)).map((r) =>
      r.exchange.toLowerCase(),
    );
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    return codigo === "ENOTFOUND" || codigo === "ENODATA" ? [] : null;
  }
}

async function cname(nombre: string): Promise<string[] | null> {
  try {
    return (await resolvedor.resolveCname(nombre)).map((r) => r.toLowerCase());
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    return codigo === "ENOTFOUND" || codigo === "ENODATA" ? [] : null;
  }
}

/** Sin comillas ni espacios de más: Resend los muestra con comillas y el DNS no. */
const normal = (v: string) =>
  v.replace(/^"|"$/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Los sufijos de dos partes que aparecen en las direcciones de las familias.
 * No es la lista pública completa: alcanza con saber que de
 * "avisos.halley.com.ar" el dominio propio es "halley.com.ar".
 */
const SUFIJOS_DOBLES = new Set([
  "com.ar",
  "net.ar",
  "org.ar",
  "gob.ar",
  "edu.ar",
  "gov.ar",
  "com.br",
  "com.mx",
  "com.uy",
  "com.py",
  "com.cl",
  "co.uk",
  "com.es",
]);

export function dominioRaiz(dominio: string) {
  const partes = dominio.toLowerCase().split(".");
  const dobles = SUFIJOS_DOBLES.has(partes.slice(-2).join("."));
  return partes.slice(dobles ? -3 : -2).join(".");
}

/* ------------------------------------------------------- registros de Resend */

export type RegistroResend = {
  record: string;
  name: string;
  type: string;
  value: string;
  status: string;
  priority?: number;
};

export type RegistroRevisado = {
  /** DKIM, SPF, etc., como lo nombra Resend. */
  proposito: string;
  tipo: string;
  /** El nombre completo, listo para buscarlo o cargarlo. */
  nombre: string;
  valor: string;
  prioridad: number | null;
  estadoResend: string;
  /** Lo que hay publicado hoy con ese nombre y ese tipo. */
  publicado: string[];
  /** Si lo que espera Resend está entre lo publicado. `null`: el DNS no contestó. */
  coincide: boolean | null;
  /**
   * Publicados que sobran y molestan: otra clave DKIM con el mismo selector u
   * otro SPF en el mismo nombre. Un TXT cualquiera de más no cuenta.
   */
  sobrantes: string[];
};

/**
 * El nombre completo de un registro que Resend da relativo.
 *
 * Para un subdominio, Resend puede darlo relativo a la raíz ("send.novedades")
 * o al subdominio ("send"). No se adivina preguntando al DNS cuál existe: el
 * mismo nombre en la raíz casi siempre existe, porque es el del dominio
 * principal, y daría por publicado un registro que no lo está.
 */
function nombreCompleto(nombre: string, dominio: string) {
  const n = nombre.toLowerCase().replace(/\.$/, "");
  if (n === dominio || n.endsWith("." + dominio)) return n;
  const raiz = dominioRaiz(dominio);
  const sub = dominio === raiz ? "" : dominio.slice(0, -raiz.length - 1);
  if (sub && (n === sub || n.endsWith("." + sub))) return `${n}.${raiz}`;
  return `${n}.${dominio}`;
}

async function publicadoEn(tipo: string, nombre: string) {
  if (tipo === "MX") return mx(nombre);
  if (tipo === "CNAME") return cname(nombre);
  return txt(nombre);
}

export async function revisarRegistro(
  r: RegistroResend,
  dominio: string,
): Promise<RegistroRevisado> {
  const elegido = nombreCompleto(r.name, dominio);
  const publicado = await publicadoEn(r.type, elegido);

  const esperado = normal(r.value);
  const coincide =
    publicado === null
      ? null
      : publicado.some(
          (p) => normal(p).replace(/\.$/, "") === esperado.replace(/\.$/, ""),
        );

  // Lo que compite con el registro bueno: la otra clave del mismo selector, el
  // otro SPF. Dos de esos en el mismo nombre rompen la verificación.
  const compite = (p: string) => {
    const v = normal(p);
    if (r.record === "DKIM") return v.startsWith("p=") || v.includes("v=dkim1");
    if (r.record === "SPF" && r.type === "TXT") return v.startsWith("v=spf1");
    return false;
  };
  const sobrantes = (publicado ?? []).filter(
    (p) => compite(p) && normal(p) !== esperado,
  );

  return {
    proposito: r.record,
    tipo: r.type,
    nombre: elegido,
    valor: r.value.replace(/^"|"$/g, ""),
    prioridad: r.priority ?? null,
    estadoResend: r.status,
    publicado: publicado ?? [],
    coincide,
    sobrantes,
  };
}

/* ------------------------------------------------------------- chequeos */

export type Chequeo = {
  clave: string;
  titulo: string;
  estado: "bien" | "atencion" | "problema" | "sin-datos";
  detalle: string;
  /** Qué hacer, cuando hay algo que hacer. */
  arreglo?: string;
  /** Un valor para copiar, cuando el arreglo es cargar o encontrar algo. */
  copiar?: string;
  /** Qué es lo que se copia, cuando no es obvio. */
  rotuloCopiar?: string;
};

/** Las claves DKIM publicadas en el selector de Resend de un dominio. */
export async function clavesDkim(dominio: string) {
  const publicados = await txt(`resend._domainkey.${dominio}`);
  if (publicados === null) return null;
  return publicados.filter((p) => {
    const v = normal(p);
    return v.startsWith("p=") || v.includes("v=dkim1");
  });
}

export async function chequeoDkim(
  dominio: string,
  esperado: string | null,
): Promise<Chequeo> {
  const claves = await clavesDkim(dominio);
  const titulo = `Firma DKIM de ${dominio}`;
  if (claves === null) {
    return {
      clave: "dkim",
      titulo,
      estado: "sin-datos",
      detalle: "El DNS no contestó a tiempo. Volvé a cargar la página.",
    };
  }
  if (claves.length === 0) {
    return {
      clave: "dkim",
      titulo,
      estado: "problema",
      detalle: `No hay ninguna clave publicada en resend._domainkey.${dominio}. Sin firma, Gmail y Outlook tratan el correo como sospechoso.`,
      arreglo:
        "Cargá en el DNS el registro DKIM que muestra Resend para este dominio.",
    };
  }
  if (claves.length > 1) {
    const buena = esperado
      ? claves.find((c) => normal(c) === normal(esperado))
      : undefined;
    const sobran = buena ? claves.filter((c) => c !== buena) : [];
    // Todas las claves RSA empiezan igual, así que el comienzo no sirve para
    // saber cuál es cuál en el panel del DNS: se muestra el tramo donde
    // empiezan a diferir.
    let comun = 0;
    while (
      claves.every((c) => c[comun] === claves[0]![comun]) &&
      comun < claves[0]!.length
    )
      comun++;
    const tramo = (c: string) => `…${c.slice(comun, comun + 14)}…`;
    return {
      clave: "dkim",
      titulo,
      estado: "problema",
      detalle: `Hay ${claves.length} claves distintas publicadas en resend._domainkey.${dominio}. Resend firma con una sola, y el que recibe el correo toma cualquiera: cuando toma la otra, la firma no verifica y el correo pierde la confianza que le daba el dominio.`,
      arreglo: buena
        ? `En el DNS, borrá el registro TXT de resend._domainkey que tiene "${tramo(sobran[0] ?? "")}" en el medio. El que tiene que quedar es el que tiene "${tramo(buena)}", que es el que usa Resend.`
        : "En el DNS, dejá en resend._domainkey sólo el registro TXT que coincide con el que muestra Resend para este dominio, y borrá el otro.",
      copiar: sobran[0],
      rotuloCopiar: "Copiar la que sobra",
    };
  }
  if (esperado && normal(claves[0]!) !== normal(esperado)) {
    return {
      clave: "dkim",
      titulo,
      estado: "problema",
      detalle:
        "La clave publicada no es la que usa Resend para firmar. Ningún correo pasa la verificación.",
      arreglo:
        "Reemplazá el registro TXT de resend._domainkey por el que muestra Resend.",
      copiar: esperado,
      rotuloCopiar: "Copiar la que va",
    };
  }
  return {
    clave: "dkim",
    titulo,
    estado: "bien",
    detalle:
      "Hay una sola clave publicada" +
      (esperado ? " y es la que usa Resend." : "."),
  };
}

export async function chequeoDmarc(dominio: string): Promise<Chequeo> {
  const raiz = dominioRaiz(dominio);
  // La política se busca primero en el dominio exacto y después en la raíz, que
  // es como la busca el que recibe.
  let registros = await txt(`_dmarc.${dominio}`);
  if (registros !== null && registros.length === 0 && raiz !== dominio)
    registros = await txt(`_dmarc.${raiz}`);
  const titulo = `Política DMARC de ${raiz}`;
  if (registros === null)
    return {
      clave: "dmarc",
      titulo,
      estado: "sin-datos",
      detalle: "El DNS no contestó a tiempo.",
    };

  const dmarc = registros.find((r) => normal(r).startsWith("v=dmarc1"));
  const sugerido = `v=DMARC1; p=none; rua=mailto:dmarc@${raiz}`;
  if (!dmarc) {
    return {
      clave: "dmarc",
      titulo,
      estado: "problema",
      detalle:
        "No hay registro DMARC. Desde 2024 Gmail y Yahoo lo exigen a quien manda en cantidad, y sin él no hay forma de enterarse si alguien manda correos haciéndose pasar por Halley.",
      arreglo:
        "Como el dominio está en Cloudflare, lo más simple es Correo electrónico > DMARC Management: lo publica en un clic y muestra los reportes ahí mismo.",
      copiar: sugerido,
      rotuloCopiar: "Copiar el registro",
    };
  }
  if (!/rua=/i.test(dmarc)) {
    return {
      clave: "dmarc",
      titulo,
      estado: "atencion",
      detalle: `Está publicado ("${dmarc}") pero sin dirección de reportes. Google y Microsoft mandan un informe por semana con cuántos correos de Halley pasaron la verificación; sin "rua" no le llegan a nadie, y un problema como el de la clave DKIM duplicada pasa sin que nadie lo vea.`,
      arreglo:
        "En Cloudflare, Correo electrónico > DMARC Management agrega la dirección de reportes y los muestra en el mismo panel. Si se carga a mano, la casilla tiene que ser del mismo dominio: los reportes no se mandan a una de Gmail.",
    };
  }
  return {
    clave: "dmarc",
    titulo,
    estado: "bien",
    detalle: `Publicado con reportes: "${dmarc}".`,
  };
}

/** Si una casilla puede recibir, como chequeo con su explicación. */
export async function chequeoCasilla(
  clave: string,
  titulo: string,
  email: string,
  queSePierde: string,
  arreglo: string,
): Promise<Chequeo> {
  const dominio = email.split("@")[1] ?? "";
  const recibe = await dominioRecibe(dominio);
  if (recibe === null)
    return {
      clave,
      titulo,
      estado: "sin-datos",
      detalle: "El DNS no contestó a tiempo.",
    };
  if (!recibe) {
    return {
      clave,
      titulo,
      estado: "problema",
      detalle: `Es ${email}, y el dominio ${dominio} no recibe correo: ${queSePierde}`,
      arreglo,
    };
  }
  return {
    clave,
    titulo,
    estado: "bien",
    detalle: `Es ${email}, y su dominio recibe correo.`,
  };
}

/**
 * La tasa de rebotes y de quejas, contra los topes con los que Resend pausa la
 * cuenta.
 *
 * Se mide sólo sobre los correos de los que llegó algún aviso de entrega. Si
 * se dividiera por todos los enviados, el primer mes después de conectar los
 * avisos mezclaría correos medidos con correos que nunca se iban a medir, y la
 * tasa saldría más baja de lo que es.
 */
export async function chequeoEntregas(
  conectados: boolean,
  /** Si la clave de Resend deja crear el webhook desde el panel. */
  conBoton: boolean,
): Promise<Chequeo> {
  const titulo = "Rebotes y quejas de los últimos 30 días";
  if (!conectados) {
    return {
      clave: "entregas",
      titulo,
      estado: "atencion",
      detalle:
        "Los avisos de entrega no están conectados. Resend no le cuenta a Halley qué correos rebotan ni quién los marca como spam, que son justo los dos números por los que pausa la cuenta: 4% de rebotes o 0,08% de quejas.",
      arreglo: conBoton
        ? "Conectalos abajo, en Avisos de entrega. Es un botón."
        : "Con la clave de Resend de hoy no se pueden conectar desde acá. Abajo, en Avisos de entrega, está cómo hacerlo a mano.",
    };
  }
  const desde = new Date(Date.now() - 30 * 86_400_000);
  const conAviso = {
    OR: [
      { entregadoEl: { gte: desde } },
      { rebotadoEl: { gte: desde } },
      { quejaEl: { gte: desde } },
    ],
  };
  const [medidos, rebotes, quejas] = await Promise.all([
    db.notificacion.count({ where: conAviso }),
    db.notificacion.count({ where: { rebotadoEl: { gte: desde } } }),
    db.notificacion.count({ where: { quejaEl: { gte: desde } } }),
  ]);
  if (medidos < 50) {
    return {
      clave: "entregas",
      titulo,
      estado: "bien",
      detalle: `Conectados. Todavía hay pocos correos medidos para sacar una tasa: ${medidos} con aviso, ${rebotes} rebote${rebotes === 1 ? "" : "s"}, ${quejas} queja${quejas === 1 ? "" : "s"}.`,
    };
  }
  const tasaRebotes = rebotes / medidos;
  const tasaQuejas = quejas / medidos;
  const pct = (x: number) =>
    `${(x * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
  const estado =
    tasaRebotes >= 0.04 || tasaQuejas >= 0.0008
      ? "problema"
      : tasaRebotes >= 0.02 || tasaQuejas >= 0.0004
        ? "atencion"
        : "bien";
  return {
    clave: "entregas",
    titulo,
    estado,
    detalle: `De ${medidos} correos medidos, ${rebotes} rebotaron (${pct(tasaRebotes)}) y ${quejas} fueron marcados como spam (${pct(tasaQuejas)}). Resend pausa la cuenta pasado el 4% de rebotes o el 0,08% de quejas.`,
    arreglo:
      estado === "bien"
        ? undefined
        : "Las direcciones que rebotaron o se quejaron están abajo, y ya no se les manda. Si los rebotes vienen de una carga nueva, revisá la lista antes del próximo envío en masa.",
  };
}

/* ------------------------------------------- direcciones de las familias */

/**
 * Los proveedores que usan las familias. Están para dos cosas: no marcar como
 * error a los que existen ("mail.com" se parece a "gmail.com" y es real), y
 * sugerir cuál quiso escribir el que se equivocó.
 */
const PROVEEDORES = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.ar",
  "hotmail.es",
  "outlook.com",
  "outlook.com.ar",
  "outlook.es",
  "live.com",
  "live.com.ar",
  "yahoo.com",
  "yahoo.com.ar",
  "icloud.com",
  "me.com",
  "msn.com",
  "mail.com",
  "gmx.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "fibertel.com.ar",
  "arnet.com.ar",
  "speedy.com.ar",
];

/** Distancia de edición, contando como un error dos letras invertidas. */
function distancia(a: string, b: string) {
  const d = Array.from(
    { length: a.length + 1 },
    (_, i) => [i, ...Array(b.length).fill(0)] as number[],
  );
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + costo,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/** El proveedor que seguramente se quiso escribir, si el dominio parece un error. */
export function proveedorParecido(dominio: string) {
  const d = dominio.toLowerCase();
  if (PROVEEDORES.includes(d)) return null;
  // "gmail.com.ar", "gmail.comm": el proveedor con algo pegado atrás.
  const conCola = PROVEEDORES.find(
    (p) => d.startsWith(p) && d.length <= p.length + 3,
  );
  if (conCola) return conCola;
  let mejor: { p: string; dist: number } | null = null;
  for (const p of PROVEEDORES) {
    const dist = distancia(d, p);
    if (dist <= (p.length >= 9 ? 2 : 1) && (!mejor || dist < mejor.dist))
      mejor = { p, dist };
  }
  return mejor?.p ?? null;
}

export type DireccionConProblema = {
  email: string;
  /**
   * "rebota" y "marco-spam" los anotó el webhook de Resend; los otros dos
   * salen de mirar la dirección.
   */
  motivo: "rebota" | "marco-spam" | "no-recibe" | "parece-mal-escrita";
  sugerencia: string | null;
  /** Lo que contestó el servidor del destinatario, si rebotó. */
  detalle: string | null;
  /** Cuándo se bloqueó, si se bloqueó. */
  desde: Date | null;
  alumnos: { id: string; nombre: string; grupoId: string; grupo: string }[];
};

/**
 * Las direcciones de familias que no van a recibir lo que se les mande.
 *
 * Mira las dos fuentes: el email de contacto que se cargó con el alumno y los
 * de las cuentas de los responsables. Las cuentas también, porque las que
 * entran sin link nunca probaron su email.
 */
export async function direccionesConProblema(): Promise<
  DireccionConProblema[]
> {
  const [contactos, tutores, bloqueadas] = await Promise.all([
    db.alumno.findMany({
      where: { emailContacto: { not: null } },
      select: {
        id: true,
        nombre: true,
        emailContacto: true,
        grupoId: true,
        grupo: { select: { nombre: true } },
      },
    }),
    db.tutor.findMany({
      select: {
        cuenta: { select: { email: true } },
        alumno: {
          select: {
            id: true,
            nombre: true,
            grupoId: true,
            grupo: { select: { nombre: true } },
          },
        },
      },
    }),
    db.direccionBloqueada.findMany(),
  ]);
  const bloqueo = new Map(bloqueadas.map((b) => [b.email, b]));

  const porEmail = new Map<string, DireccionConProblema["alumnos"]>();
  const sumar = (
    email: string,
    a: {
      id: string;
      nombre: string;
      grupoId: string;
      grupo: { nombre: string };
    },
  ) => {
    const e = email.trim().toLowerCase();
    const lista = porEmail.get(e) ?? [];
    if (!lista.some((x) => x.id === a.id))
      lista.push({
        id: a.id,
        nombre: a.nombre,
        grupoId: a.grupoId,
        grupo: a.grupo.nombre,
      });
    porEmail.set(e, lista);
  };
  for (const c of contactos) if (c.emailContacto) sumar(c.emailContacto, c);
  for (const t of tutores) sumar(t.cuenta.email, t.alumno);

  // Un dominio se pregunta una sola vez aunque lo usen trescientas familias.
  const dominios = [
    ...new Set([...porEmail.keys()].map((e) => e.split("@")[1] ?? "")),
  ];
  const recibe = new Map<string, boolean | null>();
  for (let i = 0; i < dominios.length; i += 10) {
    await Promise.all(
      dominios
        .slice(i, i + 10)
        .map(async (d) => recibe.set(d, d ? await dominioRecibe(d) : false)),
    );
  }

  const salida: DireccionConProblema[] = [];
  for (const [email, alumnos] of porEmail) {
    const dominio = email.split("@")[1] ?? "";
    const sugerencia = proveedorParecido(dominio);
    const b = bloqueo.get(email);
    if (b) {
      salida.push({
        email,
        motivo: b.motivo === "queja" ? "marco-spam" : "rebota",
        sugerencia,
        detalle: b.detalle,
        desde: b.creadoEn,
        alumnos,
      });
    } else if (recibe.get(dominio) === false) {
      salida.push({
        email,
        motivo: "no-recibe",
        sugerencia,
        detalle: null,
        desde: null,
        alumnos,
      });
    } else if (sugerencia) {
      salida.push({
        email,
        motivo: "parece-mal-escrita",
        sugerencia,
        detalle: null,
        desde: null,
        alumnos,
      });
    }
  }
  return salida.sort((a, b) => a.email.localeCompare(b.email));
}
