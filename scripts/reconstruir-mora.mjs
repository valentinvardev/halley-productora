// Reconstruye, para las 723 familias, qué parte de cada pago fue mora y qué
// mora quedó fijada por cuota, reproduciendo los pagos en orden con la
// imputación nueva y las fechas actuales. Después compara la imputación nueva
// (con esos valores) contra la vieja (suma de pagos, recargo a hoy):
//   - HOY tienen que dar exactamente lo mismo para todas las familias, porque
//     hoy no existe ningún caso fantasma (medido).
//   - Simulando el 21/10, la única diferencia tiene que ser que las 49 cuotas
//     fantasma dejan de aparecer.
// En seco por defecto; con --aplicar escribe Pago.recargo y
// CuotaAlumno.recargoFijado.
import fs from "node:fs";
import { createRequire } from "node:module";

const raiz = "C:/Users/optit/OneDrive/.wdc/Documentos/halley";
const S = "C:/Users/optit/AppData/Local/Temp/claude/c--Users-optit-OneDrive--wdc-Documentos-halley/26c70913-48e9-4711-bcc3-2447885cc25c/scratchpad";
const env = fs.readFileSync(raiz + "/.env", "utf8");
for (const l of env.split(/\r?\n/)) {
  const m = /^([A-Z_]+)=["']?(.*?)["']?\s*$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { PrismaClient } = createRequire(import.meta.url)(raiz + "/generated/prisma/index.js");
const db = new PrismaClient();
const nueva = await import("file://" + raiz + "/src/server/dominio.ts");
// La función vieja (antes del punto AB) sirve para comparar; si la copia no
// está, la reconstrucción corre igual y sólo se saltea la comparación.
const vieja = await import("file://" + S + "/dominio-vieja.ts").catch(() => null);
const aplicar = process.argv.includes("--aplicar");

const alumnos = await db.alumno.findMany({
  include: {
    grupo: { select: { nombre: true, cuotas: true } },
    pagos: { orderBy: { recibidoEn: "asc" } },
    ajustesCuota: true,
  },
});

/* ------------------------------------------------------- reconstrucción */
// Las fechas que valían cuando se pagó, en los cursos cuyas fechas se movieron
// después. Inmaculada RV se corrió el 15/10/2026 con Gestión de fechas (foto de
// la confirmación: 20/09->20/05, 20/10->20/08, 20/11->20/09, 20/12->20/10,
// 20/01->20/11, 20/02->20/12, 20/03->20/01); todos sus pagos son anteriores.
// Reconstruir con las fechas de hoy le fijaría a quien pagó a tiempo una mora
// que nunca debió. Para la mora viva de lo impago siguen valiendo las de hoy.
const FECHAS_ANTERIORES = {
  "INMACULADA RV": { 1: "2026-09-20", 2: "2026-10-20", 3: "2026-11-20", 4: "2026-12-20", 5: "2027-01-20", 6: "2027-02-20", 7: "2027-03-20" },
};
const conFechasDeEntonces = (grupoNombre, cuotas) => {
  const ant = FECHAS_ANTERIORES[grupoNombre];
  if (!ant) return cuotas;
  return cuotas.map((c) => (ant[c.numero] ? { ...c, venceEl: new Date(ant[c.numero] + "T12:00:00") } : c));
};

const porAlumno = new Map(); // alumnoId -> { pagos: [{id, monto, recargo}], ajustes, fijados: Map }
let pagosConMora = 0, moraTotal = 0, cuotasFijadas = 0;
for (const a of alumnos) {
  const cuotas = conFechasDeEntonces(a.grupo.nombre, a.grupo.cuotas);
  let ajustes = a.ajustesCuota.map((x) => ({ ...x, recargoFijado: null }));
  const pagosMem = [];
  const fijados = new Map();
  for (const p of a.pagos) {
    const plan = nueva.imputarPagos(cuotas, ajustes, nueva.sumarPagos(pagosMem), p.recibidoEn);
    const liq = nueva.liquidarPago(plan, Number(p.monto));
    pagosMem.push({ id: p.id, monto: Number(p.monto), recargo: liq.recargo });
    ajustes = nueva.conFijados(ajustes, liq.fijar);
    for (const f of liq.fijar) fijados.set(f.cuotaId, f.recargo);
    if (liq.recargo > 0.01) { pagosConMora += 1; moraTotal += liq.recargo; }
  }
  cuotasFijadas += fijados.size;
  porAlumno.set(a.id, { pagos: pagosMem, ajustes, fijados });
}
console.log("familias:", alumnos.length, "| pagos:", alumnos.reduce((t, a) => t + a.pagos.length, 0));
console.log("pagos que incluyeron mora:", pagosConMora, "| mora saldada reconstruida: $" + Math.round(moraTotal));
console.log("cuotas con mora fijada:", cuotasFijadas);

/* ------------------------------------------------------------- comparar */
function comparar(etiqueta, ahoraNueva, hackVieja) {
  let distintas = 0, deudaVieja = 0, deudaNueva = 0;
  // Las familias de cursos con fechas movidas pueden diferir hoy a propósito:
  // la vieja les cobra mora con la fecha nueva y la nueva respeta lo pagado.
  let distintasEsperadas = 0, moraQuitada = 0;
  const ejemplos = [];
  let fantasmaVieja = 0, fantasmaNueva = 0;
  for (const a of alumnos) {
    if (a.grupo.cuotas.length === 0) continue;
    const mem = porAlumno.get(a.id);
    const Real = Date;
    let v;
    if (hackVieja) {
      const FALSA = hackVieja.getTime();
      global.Date = class extends Real { constructor(...x) { super(...(x.length ? x : [FALSA])); } static now() { return FALSA; } };
      v = vieja.imputarPagos(a.grupo.cuotas, a.ajustesCuota, vieja.sumarPagos(a.pagos));
      global.Date = Real;
    } else {
      v = vieja.imputarPagos(a.grupo.cuotas, a.ajustesCuota, vieja.sumarPagos(a.pagos));
    }
    const n = nueva.imputarPagos(a.grupo.cuotas, mem.ajustes, nueva.sumarPagos(mem.pagos), ahoraNueva);
    deudaVieja += v.deuda; deudaNueva += n.deuda;
    const esFantasma = (c) => c.estado === "VENCIDA" && c.recargo > 0 && c.saldoSinMora <= 0.01;
    fantasmaVieja += v.cuotas.filter(esFantasma).length;
    fantasmaNueva += n.cuotas.filter(esFantasma).length;
    const dif = Math.abs(v.deuda - n.deuda) > 0.01 || v.cuotas.some((c, i) => c.estado !== n.cuotas[i].estado || Math.abs(c.saldo - n.cuotas[i].saldo) > 0.01);
    if (dif && FECHAS_ANTERIORES[a.grupo.nombre]) {
      distintasEsperadas += 1;
      moraQuitada += v.deuda - n.deuda;
      continue;
    }
    if (dif) {
      distintas += 1;
      if (ejemplos.length < 6) {
        const i = v.cuotas.findIndex((c, k) => c.estado !== n.cuotas[k].estado || Math.abs(c.saldo - n.cuotas[k].saldo) > 0.01);
        const cv = v.cuotas[i], cn = n.cuotas[i];
        ejemplos.push(`${a.nombre} (${a.grupo.nombre}) cuota ${cv?.numero}: vieja ${cv?.estado} saldo $${Math.round(cv?.saldo)} | nueva ${cn?.estado} saldo $${Math.round(cn?.saldo)} | pagos ${mem.pagos.map((p) => p.monto + (p.recargo ? "(m" + Math.round(p.recargo) + ")" : "")).join(",")}`);
      }
    }
  }
  console.log(`\n=== ${etiqueta}`);
  console.log("familias con algún resultado distinto (fuera de los cursos con fechas movidas):", distintas);
  console.log("familias de cursos con fechas movidas que difieren a propósito:", distintasEsperadas, "| mora que la vieja les cobra de más: $" + Math.round(moraQuitada));
  console.log("deuda total vieja $" + Math.round(deudaVieja) + " | nueva $" + Math.round(deudaNueva));
  console.log("cuotas fantasma (pagadas que figuran vencidas): vieja", fantasmaVieja, "| nueva", fantasmaNueva);
  for (const e of ejemplos) console.log("  ·", e);
  return distintas;
}

let hoyDistintas = 0;
if (vieja) {
  hoyDistintas = comparar("HOY", new Date(), null);
  const oct = new Date("2026-10-21T15:00:00-03:00");
  comparar("SIMULANDO EL 21/10/2026", oct, oct);
  const nov = new Date("2026-11-21T15:00:00-03:00");
  comparar("SIMULANDO EL 21/11/2026", nov, nov);
} else {
  console.log("\n(sin la copia de la función vieja: se reconstruye sin comparar)");
}

/* -------------------------------------------------------------- escribir */
if (!aplicar) {
  console.log("\n(en seco: nada escrito. Con --aplicar se escriben Pago.recargo y CuotaAlumno.recargoFijado)");
} else if (hoyDistintas > 0) {
  console.log("\nNO SE APLICA: hoy hay diferencias y tiene que haber cero.");
} else {
  let pagosEscritos = 0, filasEscritas = 0;
  for (const a of alumnos) {
    const mem = porAlumno.get(a.id);
    for (const p of mem.pagos) {
      await db.pago.update({ where: { id: p.id }, data: { recargo: Math.round(p.recargo * 100) / 100 } });
      pagosEscritos += 1;
    }
    for (const [cuotaId, recargo] of mem.fijados) {
      await db.cuotaAlumno.upsert({
        where: { alumnoId_cuotaId: { alumnoId: a.id, cuotaId } },
        create: { alumnoId: a.id, cuotaId, recargoFijado: Math.round(recargo * 100) / 100 },
        update: { recargoFijado: Math.round(recargo * 100) / 100 },
      });
      filasEscritas += 1;
    }
  }
  console.log(`\nAPLICADO: ${pagosEscritos} pagos con su recargo, ${filasEscritas} cuotas con mora fijada.`);
}
await db.$disconnect();
