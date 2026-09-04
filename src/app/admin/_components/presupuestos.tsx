"use client";

import Link from "next/link";
import { useState } from "react";

import {
  IconoAlerta,
  IconoBajar,
  IconoCalculadora,
  IconoLista,
  IconoPapelera,
  IconoRegalo,
  IconoTilde,
  IconoWhatsApp,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import {
  Boton,
  BotonTexto,
  Encabezado,
  Tag,
  Vacio,
  botonFantasma,
} from "~/app/_components/ui";
import {
  EVENTOS,
  EVENTOS_ORDEN,
  muestraMonto,
  planDe,
  type Evento,
} from "~/app/_datos/presupuesto";
import { fecha, fechaHora, pesos } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

import { VerPresupuesto } from "./ver-presupuesto";

/**
 * Los presupuestos que llegaron del simulador.
 *
 * Son consultas, no clientes: alguien entró a la web, armó su cobertura y dejó
 * el teléfono. Por eso la lista no vive dentro de un grupo —el grupo se crea
 * después, si el evento se cierra— y por eso lo único que se puede hacer desde
 * acá es leerla, escribirle y tacharla.
 *
 * Se ordena por fecha y se marca a quién ya se contactó. Sin esa marca, una
 * lista de consultas obliga a acordarse de memoria a quién le escribiste, que
 * es exactamente lo que se deja de hacer bien apenas hay más de cinco.
 */
export function Presupuestos() {
  const [filtro, setFiltro] = useState<Evento | null>(null);
  const [aBorrar, setABorrar] = useState<{ id: string; codigo: string } | null>(
    null,
  );
  /** El código que se está mirando en el visor, o `null`. */
  const [viendo, setViendo] = useState<string | null>(null);

  const utils = api.useUtils();
  const lista = api.presupuesto.listar.useQuery(
    filtro ? { evento: filtro } : {},
  );

  const refrescar = () => utils.presupuesto.listar.invalidate();

  /**
   * Marcar contactado se pinta antes de que el servidor conteste.
   *
   * Es un tilde, no una transferencia: la respuesta no aporta nada que no se
   * sepa de antemano, y esperarla dejaba la insignia quieta medio segundo
   * después del clic, el tiempo justo para que uno vuelva a apretar. Se cambia
   * en la caché de una, y si el pedido falla se deja como estaba.
   */
  const claveLista = filtro ? { evento: filtro } : {};
  const marcar = api.presupuesto.marcarContactado.useMutation({
    onMutate: async ({ id, contactado }) => {
      // Sin esto, una consulta que ya estaba viajando podría llegar después y
      // pisar el cambio con el estado viejo.
      await utils.presupuesto.listar.cancel(claveLista);

      const previo = utils.presupuesto.listar.getData(claveLista);
      utils.presupuesto.listar.setData(claveLista, (filas) =>
        filas?.map((f) =>
          f.id === id
            ? { ...f, contactadoEn: contactado ? new Date() : null }
            : f,
        ),
      );
      return { previo };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) utils.presupuesto.listar.setData(claveLista, ctx.previo);
    },
    // Se confirma contra el servidor igual, pero recién al final: para entonces
    // la pantalla ya cambió y nadie ve el reemplazo.
    onSettled: refrescar,
  });
  const borrar = api.presupuesto.eliminar.useMutation({
    onSuccess: async () => {
      setABorrar(null);
      await refrescar();
    },
  });

  const filas = lista.data ?? [];
  const pendientes = filas.filter((p) => !p.contactadoEn).length;

  return (
    <>
      <Encabezado
        eyebrow="Simulador"
        titulo="Presupuestos"
        bajada="Lo que armó la gente en el simulador de la web. Todavía no son clientes: son consultas con precio puesto."
        acciones={
          <>
            <Link href="/admin/presupuestos/paquetes" className={botonFantasma}>
              <IconoRegalo />
              Paquetes
            </Link>
            <Link href="/admin/presupuestos/flujo" className={botonFantasma}>
              <IconoCalculadora />
              Flujo del presupuesto
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(
          [
            [null, "Todos"],
            ...EVENTOS_ORDEN.map((e) => [e, EVENTOS[e].nombre] as const),
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={texto}
            type="button"
            onClick={() => setFiltro(valor)}
            className={`border px-3.5 py-2 font-rotulo text-[11.5px] tracking-[0.06em] uppercase transition-colors ${
              filtro === valor
                ? "border-ink bg-ink text-paper"
                : "border-gray-20 text-gray-70 hover:border-ink hover:text-ink"
            }`}
          >
            {texto}
          </button>
        ))}

        {pendientes > 0 && (
          <span className="nota ml-auto text-[11.5px]">
            {pendientes} sin contactar
          </span>
        )}
      </div>

      {lista.isPending ? (
        <p className="nota">Cargando…</p>
      ) : filas.length === 0 ? (
        <Vacio>Todavía no armó un presupuesto nadie.</Vacio>
      ) : (
        <div className="border border-ink">
          {filas.map((p) => (
            <Fila
              key={p.id}
              p={p}
              alVer={() => setViendo(p.codigo)}
              alMarcar={(contactado) => marcar.mutate({ id: p.id, contactado })}
              alBorrar={() => setABorrar({ id: p.id, codigo: p.codigo })}
            />
          ))}
        </div>
      )}

      <VerPresupuesto codigo={viendo} alCerrar={() => setViendo(null)} />

      <Modal
        abierto={aBorrar !== null}
        alCerrar={() => setABorrar(null)}
        eyebrow={aBorrar?.codigo}
        titulo="Borrar el presupuesto"
      >
        <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-gray-70">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Se borra el presupuesto y el link con su código deja de funcionar.
            Si esa persona lo tenía guardado, va a ver una página que no existe.
          </span>
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setABorrar(null)}>
            Cancelar
          </Boton>
          <Boton
            onClick={() => aBorrar && borrar.mutate({ id: aBorrar.id })}
            disabled={borrar.isPending}
          >
            <IconoPapelera />
            {borrar.isPending ? "Borrando…" : "Borrar"}
          </Boton>
        </div>
      </Modal>
    </>
  );
}

type Consulta = RouterOutputs["presupuesto"]["listar"][number];

function Fila({
  p,
  alVer,
  alMarcar,
  alBorrar,
}: {
  p: Consulta;
  alVer: () => void;
  alMarcar: (contactado: boolean) => void;
  alBorrar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const plan = planDe(p.plan);
  const contactado = p.contactadoEn !== null;

  const wa = `https://wa.me/${p.celular.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hola ${p.nombre.split(" ")[0] ?? ""}, soy de Halley Audiovisual. Vi el presupuesto que armaste (${p.codigo}).`,
  )}`;

  return (
    <div className="border-b border-gray-20 last:border-b-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-paper-dim"
      >
        {/* El chevron dice que esto se abre. Sin él, una fila que reacciona al
            clic pero no anuncia nada se descubre por accidente. */}
        <IconoBajar
          className={`h-3 w-3 shrink-0 text-gray-45 transition-transform duration-200 ${
            abierto ? "" : "-rotate-90"
          }`}
        />

        <Tag>{EVENTOS[p.evento].nombre}</Tag>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px]">{p.nombre}</span>
          <span className="block truncate font-mono text-[10.5px] text-gray-45">
            {p.codigo}
          </span>
        </span>

        {/* La insignia marca la excepción, no la regla: al principio nadie está
            contactado, así que lo que hay que poder ver de un vistazo es a
            quién ya le escribiste. Marcar lo contrario pintaría la lista entera
            y no diría nada. */}
        {contactado && (
          <span className="inline-flex shrink-0 items-center gap-1.5 border border-ink bg-ink px-2 py-1 font-rotulo text-[10.5px] tracking-[0.06em] text-paper uppercase">
            <IconoTilde className="h-3 w-3" />
            Contactado
          </span>
        )}

        <span className="font-display text-[15px] tabular-nums">
          {pesos(p.total)}
        </span>

        <span className="nota w-full text-[11px] sm:w-auto">
          {fechaHora(p.creadoEn)}
        </span>
      </button>

      <div
        className={`despliegue ${abierto ? "border-t border-gray-20" : ""}`}
        data-abierto={abierto ? "si" : "no"}
        inert={!abierto}
      >
        <div className="bg-paper-dim">
          <div className="px-4 py-4">
            <dl className="grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
              <Dupla rotulo="Celular" valor={p.celular} />
              <Dupla rotulo="Email" valor={p.email} />
              <Dupla
                rotulo="Fecha del evento"
                valor={p.fechaEvento ? fecha(p.fechaEvento) : "Sin definir"}
              />
              <Dupla rotulo="Forma de pago" valor={plan?.nombre ?? p.plan} />
              <Dupla rotulo="Reserva" valor={pesos(p.reserva)} />
              <Dupla
                rotulo="Copia por mail"
                valor={p.quiereCopia ? "Sí, la pidió" : "No"}
              />
            </dl>

            <ul className="mt-4 divide-y divide-gray-20 border-y border-gray-20">
              {p.lineas.map((l) => (
                <li
                  key={l.id}
                  className="flex items-baseline justify-between gap-4 py-2 text-[13.5px]"
                >
                  <span>
                    {l.nombre}
                    {l.detalle && (
                      <span className="text-gray-45"> — {l.detalle}</span>
                    )}
                  </span>
                  {muestraMonto(l) && (
                    <span className="font-display tabular-nums">
                      {pesos(l.precio)}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-rotulo text-[11.5px] tracking-[0.05em] uppercase underline underline-offset-2 hover:text-gray-70"
              >
                <IconoWhatsApp className="h-3.5 w-3.5" />
                Escribirle
              </a>

              <BotonTexto onClick={alVer}>
                <IconoLista />
                Ver el presupuesto
              </BotonTexto>

              <BotonTexto onClick={() => alMarcar(!contactado)}>
                <IconoTilde />
                {contactado
                  ? `Contactado el ${fecha(p.contactadoEn!)} — deshacer`
                  : "Marcar contactado"}
              </BotonTexto>

              <BotonTexto onClick={alBorrar} className="ml-auto text-gray-45">
                <IconoPapelera />
                Borrar
              </BotonTexto>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dupla({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-20 py-1.5">
      <dt className="font-rotulo text-[11px] tracking-[0.06em] text-gray-45 uppercase">
        {rotulo}
      </dt>
      <dd className="text-right break-all">{valor}</dd>
    </div>
  );
}
