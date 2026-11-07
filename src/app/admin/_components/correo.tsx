"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Copiar } from "~/app/_components/copiar";
import { IconoAlerta } from "~/app/_components/iconos";
import { Boton, BotonTexto, Campo, Encabezado, Tag, Vacio } from "~/app/_components/ui";
import { fecha } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

type Estado = RouterOutputs["correo"]["estado"];
type Chequeo = Estado["salud"][number];
type Dominio = Estado["dominios"][number];

const ROTULO_CHEQUEO: Record<Chequeo["estado"], string> = {
  bien: "Bien",
  atencion: "Revisar",
  problema: "Problema",
  "sin-datos": "Sin datos",
};

const ROTULO_DOMINIO: Record<string, string> = {
  verified: "Verificado",
  pending: "Verificando",
  not_started: "Sin verificar",
  failed: "Falló",
  partially_verified: "Verificado a medias",
  partially_failed: "Falló en parte",
  temporary_failure: "Falla temporal",
};

/**
 * Dominios y entrega.
 *
 * Arriba lo que hay que hacer, abajo de dónde sale. Es el orden en que se lee
 * la pantalla cuando alguien entra preguntándose por qué un correo fue a spam:
 * primero si hay algo roto, después el detalle para arreglarlo.
 */
export function CorreoEntrega() {
  const { data, isLoading, error } = api.correo.estado.useQuery(undefined, {
    // Cada carga le pregunta al DNS y a Resend: no es algo para refrescar solo.
    refetchOnWindowFocus: false,
  });

  return (
    <>
      <Encabezado
        eyebrow="Cobros — notificaciones"
        titulo="Dominios y entrega"
        bajada="Lo que decide si un correo de Halley llega a la bandeja de entrada o al spam. Los dominios viven en Resend y el DNS en Cloudflare: acá se comparan los dos con lo que está publicado de verdad."
        acciones={
          <Link
            href="/admin/notificaciones"
            className="inline-flex items-center gap-2 border border-ink px-4 py-2.5 font-rotulo text-[12px] tracking-[0.06em] uppercase transition-colors hover:bg-ink hover:text-paper"
          >
            Volver a la bandeja
          </Link>
        }
      />

      {isLoading && (
        <p className="nota mb-8">Preguntando al DNS y a Resend… tarda unos segundos.</p>
      )}
      {error && <p className="nota mb-8 text-marca">{error.message}</p>}

      {data && (
        <>
          <Salud chequeos={data.salud} />
          <Dominios
            clave={data.clave}
            errorClave={data.errorClave}
            dominios={data.dominios}
            propio={data.dominio}
          />
          <AvisosDeEntrega webhook={data.webhook} clave={data.clave} />
          <Direcciones direcciones={data.direcciones} />
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- piezas */

function Caja({
  titulo,
  extra,
  children,
}: {
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 border border-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-20 px-5 py-3">
        <h3 className="font-rotulo text-[12px] tracking-[0.06em] uppercase">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Salud({ chequeos }: { chequeos: Chequeo[] }) {
  const problemas = chequeos.filter((c) => c.estado === "problema").length;
  const revisar = chequeos.filter((c) => c.estado === "atencion").length;

  // Lo roto primero: es lo que se vino a buscar.
  const orden = { problema: 0, atencion: 1, "sin-datos": 2, bien: 3 } as const;
  const ordenados = [...chequeos].sort((a, b) => orden[a.estado] - orden[b.estado]);

  return (
    <Caja
      titulo="Salud del correo"
      extra={
        <span className={`nota text-[11.5px] ${problemas ? "text-marca" : "text-gray-45"}`}>
          {problemas || revisar
            ? [
                problemas && `${problemas} problema${problemas === 1 ? "" : "s"}`,
                revisar && `${revisar} para revisar`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Todo en orden"}
        </span>
      }
    >
      <ul>
        {ordenados.map((c) => (
          <li
            key={c.clave}
            className="grid gap-x-5 gap-y-1.5 border-b border-gray-20 px-5 py-4 last:border-b-0 sm:grid-cols-[110px_1fr]"
          >
            <span
              className={`font-rotulo text-[11px] tracking-[0.08em] uppercase ${
                c.estado === "problema"
                  ? "text-marca"
                  : c.estado === "bien"
                    ? "text-gray-45"
                    : "text-ink"
              }`}
            >
              {ROTULO_CHEQUEO[c.estado]}
            </span>
            <div className="min-w-0">
              <div className="text-[14px]">{c.titulo}</div>
              <p className="nota mt-1 max-w-[78ch] text-[12.5px] text-gray-70">{c.detalle}</p>
              {c.arreglo && (
                <p className="nota mt-2 max-w-[78ch] border-l-2 border-ink pl-3 text-[12.5px] text-ink">
                  {c.arreglo}
                </p>
              )}
              {c.copiar && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <code className="max-w-full truncate font-mono text-[11px] text-gray-70">
                    {c.copiar}
                  </code>
                  <Copiar valor={c.copiar} etiqueta={c.rotuloCopiar} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Caja>
  );
}

function Dominios({
  clave,
  errorClave,
  dominios,
  propio,
}: {
  clave: Estado["clave"];
  errorClave: string | null;
  dominios: Dominio[];
  propio: string;
}) {
  return (
    <Caja
      titulo="Dominios en Resend"
      extra={
        clave === "completa" && (
          <span className="nota text-[11.5px] text-gray-45">
            {dominios.length} dominio{dominios.length === 1 ? "" : "s"}
          </span>
        )
      }
    >
      {clave !== "completa" ? (
        <div className="px-5 py-4">
          <p className="nota max-w-[70ch] text-[12.5px]">
            {clave === "sin-clave"
              ? "El servidor no tiene clave de Resend: los correos no están saliendo de verdad."
              : errorClave}
          </p>
          {clave === "restringida" && (
            <p className="nota mt-2 max-w-[70ch] text-[12.5px] text-gray-70">
              En Resend, API Keys, creá una con permiso Full access, ponela en
              RESEND_API_KEY en el servidor y reiniciá. La salud del correo de
              arriba funciona igual: sale del DNS, no de Resend.
            </p>
          )}
        </div>
      ) : (
        <>
          {dominios.length === 0 && (
            <div className="px-5 py-4">
              <Vacio>No hay dominios en la cuenta de Resend.</Vacio>
            </div>
          )}
          {dominios.map((d) => (
            <FichaDominio key={d.id} dominio={d} enUso={d.nombre === propio} />
          ))}
          <AgregarDominio raiz={propio} />
        </>
      )}
    </Caja>
  );
}

function FichaDominio({ dominio, enUso }: { dominio: Dominio; enUso: boolean }) {
  const utils = api.useUtils();
  const verificar = api.correo.verificarDominio.useMutation({
    onSuccess: () => utils.correo.estado.invalidate(),
  });

  return (
    <div className="border-b border-gray-20 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-display text-[19px]">{dominio.nombre}</span>
          <Tag activo={dominio.estado === "verified"}>
            {ROTULO_DOMINIO[dominio.estado] ?? dominio.estado}
          </Tag>
          {enUso && <span className="nota text-[11.5px] text-gray-45">es el remitente de hoy</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="nota text-[11px] text-gray-45">{dominio.region}</span>
          {dominio.estado !== "verified" && (
            <Boton
              variante="fantasma"
              className="!px-3 !py-2 !text-[11px]"
              disabled={verificar.isPending}
              onClick={() => verificar.mutate({ id: dominio.id })}
            >
              {verificar.isPending ? "Pidiendo…" : "Verificar ahora"}
            </Boton>
          )}
        </div>
      </div>
      {verificar.isError && <p className="nota mt-2 text-marca">{verificar.error.message}</p>}
      {verificar.isSuccess && dominio.estado !== "verified" && (
        <p className="nota mt-2 text-[12px]">
          Resend está mirando el DNS. Puede tardar unos minutos; volvé a cargar la página.
        </p>
      )}

      <div className="mt-3 grid gap-2">
        {dominio.registros.map((r, i) => (
          <div key={i} className="border border-gray-20 px-3.5 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-rotulo text-[11px] tracking-[0.06em] uppercase">
                {r.proposito} · {r.tipo}
                {r.prioridad !== null && ` · prioridad ${r.prioridad}`}
              </span>
              <EstadoPublicado coincide={r.coincide} sobrantes={r.sobrantes.length} />
            </div>
            <div className="mt-1.5 grid gap-1 text-[12px] sm:grid-cols-[70px_1fr_auto] sm:items-center sm:gap-x-3">
              <span className="nota text-[11px] text-gray-45">Nombre</span>
              <code className="min-w-0 truncate font-mono text-[11.5px]">{r.nombre}</code>
              <Copiar valor={r.nombre} />
              <span className="nota text-[11px] text-gray-45">Valor</span>
              <code className="min-w-0 truncate font-mono text-[11.5px]">{r.valor}</code>
              <Copiar valor={r.valor} />
            </div>
            {r.sobrantes.map((s) => (
              <p key={s} className="nota mt-1.5 flex items-start gap-2 text-[11.5px] text-marca">
                <IconoAlerta className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="min-w-0 break-all">De más, hay que borrarlo: {s.slice(0, 60)}…</span>
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EstadoPublicado({ coincide, sobrantes }: { coincide: boolean | null; sobrantes: number }) {
  if (coincide === null) return <span className="nota text-[11px] text-gray-45">El DNS no contestó</span>;
  if (!coincide) return <span className="nota text-[11px] text-marca">No está publicado</span>;
  if (sobrantes) return <span className="nota text-[11px] text-marca">Publicado, con uno de más</span>;
  return <span className="nota text-[11px] text-gray-45">Publicado</span>;
}

function AgregarDominio({ raiz }: { raiz: string }) {
  const [nombre, setNombre] = useState("");
  const utils = api.useUtils();
  const agregar = api.correo.agregarDominio.useMutation({
    onSuccess: () => {
      setNombre("");
      void utils.correo.estado.invalidate();
    },
  });

  return (
    <div className="px-5 py-4">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim()) agregar.mutate({ nombre });
        }}
      >
        <Campo
          label="Agregar un dominio o subdominio"
          placeholder={`novedades.${raiz || "halleyaudiovisual.com"}`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Boton type="submit" disabled={!nombre.trim() || agregar.isPending}>
          {agregar.isPending ? "Agregando…" : "Agregar"}
        </Boton>
      </form>
      {agregar.isError && <p className="nota mt-2 text-marca">{agregar.error.message}</p>}
      <p className="nota mt-3 max-w-[78ch] text-[12px] text-gray-70">
        Un subdominio sirve para separar los envíos en masa de los avisos que no
        pueden fallar, como el link para entrar: si un día los masivos caen en
        spam, los avisos no se arrastran con ellos. No sirve para mandar más: el
        cupo es de la cuenta, no de cada dominio. Al agregarlo, Resend da los
        registros para cargar en Cloudflare; después se verifica desde acá.
      </p>
    </div>
  );
}

function AvisosDeEntrega({
  webhook,
  clave,
}: {
  webhook: Estado["webhook"];
  clave: Estado["clave"];
}) {
  const utils = api.useUtils();
  const conectar = api.correo.conectarWebhook.useMutation({
    onSuccess: () => utils.correo.estado.invalidate(),
  });

  return (
    <Caja
      titulo="Avisos de entrega"
      extra={
        <span className={`nota text-[11.5px] ${webhook.conectado ? "text-gray-45" : "text-ink"}`}>
          {webhook.conectado ? "Conectados" : "Sin conectar"}
        </span>
      }
    >
      <div className="px-5 py-4">
        {webhook.conectado ? (
          <p className="nota max-w-[78ch] text-[12.5px]">
            Resend avisa a Halley cuando un correo llega, rebota o alguien lo
            marca como spam. Cada aviso queda en la fila de la bandeja, y las
            direcciones que rebotan o se quejan se bloquean solas: a las que
            rebotan no se les manda nada más, y a las que se quejan no se les
            mandan invitaciones ni recordatorios.
            {webhook.origen === "entorno" &&
              " Están conectados a mano, con la clave en RESEND_WEBHOOK_SECRET."}
          </p>
        ) : (
          <>
            <p className="nota max-w-[78ch] text-[12.5px]">
              Hoy "Enviado" sólo quiere decir que Resend aceptó el correo. No se
              sabe si llegó, si rebotó o si alguien lo marcó como spam, y se le
              sigue escribiendo a direcciones que no existen. Conectar los
              avisos le pide a Resend que avise de cada entrega a{" "}
              <code className="font-mono text-[11.5px]">{webhook.url}</code>.
            </p>
            {clave === "completa" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Boton
                  onClick={() => conectar.mutate()}
                  disabled={conectar.isPending}
                >
                  {conectar.isPending ? "Conectando…" : "Conectar los avisos"}
                </Boton>
                {conectar.isError && (
                  <span className="nota text-marca">{conectar.error.message}</span>
                )}
              </div>
            ) : (
              <p className="nota mt-2 max-w-[78ch] text-[12.5px] text-gray-70">
                Para conectarlos desde acá hace falta una clave de Resend con
                acceso completo. Si no, se puede crear a mano: en Resend,
                Webhooks, con esa dirección y los eventos de correo, y poner el
                Signing secret en RESEND_WEBHOOK_SECRET en el servidor.
              </p>
            )}
          </>
        )}
      </div>
    </Caja>
  );
}

const ROTULO_DIRECCION: Record<Estado["direcciones"][number]["motivo"], string> = {
  rebota: "Rebotó",
  "marco-spam": "Marcó un correo como spam",
  "no-recibe": "El dominio no existe",
  "parece-mal-escrita": "Parece mal escrita",
};

function Direcciones({ direcciones }: { direcciones: Estado["direcciones"] }) {
  const utils = api.useUtils();
  const desbloquear = api.correo.desbloquear.useMutation({
    onSuccess: () => utils.correo.estado.invalidate(),
  });

  return (
    <Caja
      titulo="Direcciones que no van a llegar"
      extra={
        <span className="nota text-[11.5px] text-gray-45">
          {direcciones.length} dirección{direcciones.length === 1 ? "" : "es"}
        </span>
      }
    >
      {direcciones.length === 0 ? (
        <p className="nota px-5 py-4 text-[12.5px]">
          Ninguna: todas las direcciones cargadas tienen un dominio que recibe correo.
        </p>
      ) : (
        <ul>
          {direcciones.map((d) => (
            <li
              key={d.email}
              className="grid gap-x-5 gap-y-1 border-b border-gray-20 px-5 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-baseline"
            >
              <code className="min-w-0 truncate font-mono text-[12px]">{d.email}</code>
              <span className={`nota text-[12px] ${d.motivo === "parece-mal-escrita" ? "" : "text-marca"}`}>
                {ROTULO_DIRECCION[d.motivo]}
                {d.desde && ` el ${fecha(d.desde)}`}
                {d.sugerencia && ` · ¿${d.email.split("@")[0]}@${d.sugerencia}?`}
                {d.detalle && (
                  <span className="block text-[11px] text-gray-45">{d.detalle}</span>
                )}
                {(d.motivo === "rebota" || d.motivo === "marco-spam") && (
                  <BotonTexto
                    className="mt-1 text-ink"
                    disabled={desbloquear.isPending}
                    onClick={() => desbloquear.mutate({ email: d.email })}
                  >
                    Quitar el bloqueo
                  </BotonTexto>
                )}
              </span>
              <span className="nota min-w-0 text-[12px]">
                {d.alumnos.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ", "}
                    <Link href={`/admin/grupos/${a.grupoId}`} className="underline underline-offset-2 hover:text-gray-70">
                      {a.nombre}
                    </Link>
                    <span className="text-gray-45"> · {a.grupo}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Caja>
  );
}
