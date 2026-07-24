"use client";

import { useState } from "react";

import {
  IconoEstrella,
  IconoMas,
  IconoPapelera,
} from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { Boton, Campo, Encabezado, Tag, Vacio } from "~/app/_components/ui";
import { api } from "~/trpc/react";
import { EsqueletoCuentas } from "./esqueletos";

const PROVEEDORES = [
  { valor: "TALO", etiqueta: "Talo" },
  { valor: "MERCADOPAGO", etiqueta: "Mercado Pago" },
] as const;

type Proveedor = (typeof PROVEEDORES)[number]["valor"];

/**
 * Las cuentas que reciben los cobros.
 *
 * Cada socio carga la suya y cada grupo se rutea a una, así el dinero de un
 * evento cae donde corresponde. La credencial se escribe una vez y no vuelve a
 * mostrarse: el panel sólo ve los últimos caracteres para reconocerla.
 */
export function CuentasPago() {
  const utils = api.useUtils();
  const { data: cuentas, isLoading } = api.cuentaPago.listar.useQuery();
  const [creando, setCreando] = useState(false);
  const [aBorrar, setABorrar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refrescar = () => utils.cuentaPago.listar.invalidate();

  const porDefecto = api.cuentaPago.porDefecto.useMutation({ onSuccess: refrescar });
  const actualizar = api.cuentaPago.actualizar.useMutation({ onSuccess: refrescar });
  const eliminar = api.cuentaPago.eliminar.useMutation({
    onSuccess: async () => {
      setABorrar(null);
      setError(null);
      await refrescar();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <>
      <Encabezado
        eyebrow="Cobros"
        titulo="Cuentas de pago"
        bajada="Dónde cae el dinero. Cada grupo se rutea a una cuenta; la marcada por defecto cobra los que no eligieron ninguna."
        acciones={
          !creando ? (
            <Boton onClick={() => setCreando(true)}>
              <IconoMas />
              Nueva cuenta
            </Boton>
          ) : undefined
        }
      />

      {creando && (
        <FormularioCuenta
          alCerrar={() => setCreando(false)}
          alCrear={async () => {
            setCreando(false);
            await refrescar();
          }}
        />
      )}

      {error && (
        <p className="nota mb-6 border border-marca px-4 py-3 text-marca">{error}</p>
      )}

      {isLoading ? (
        <EsqueletoCuentas />
      ) : !cuentas || cuentas.length === 0 ? (
        <Vacio>
          Todavía no hay cuentas — sin ninguna, los cobros usan la configuración
          del entorno
        </Vacio>
      ) : (
        <div className="border border-ink">
          {cuentas.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-20 px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[15px]">{c.nombre}</span>
                  {c.porDefecto && <Tag activo>Por defecto</Tag>}
                  {!c.activa && <Tag>Inactiva</Tag>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-rotulo text-[11px] uppercase tracking-[0.08em] text-gray-45">
                    {c.proveedor === "TALO" ? "Talo" : "Mercado Pago"}
                  </span>
                  <span className="font-mono text-[11px] text-gray-45">
                    {c.pista}
                  </span>
                  <span className="nota text-[11.5px] text-gray-45">
                    {c.grupos} {c.grupos === 1 ? "grupo" : "grupos"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!c.porDefecto && (
                  <button
                    type="button"
                    onClick={() => porDefecto.mutate({ id: c.id })}
                    className="inline-flex cursor-pointer items-center gap-1.5 font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink"
                  >
                    <IconoEstrella className="h-3.5 w-3.5" />
                    Por defecto
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    actualizar.mutate({ id: c.id, activa: !c.activa })
                  }
                  className="cursor-pointer font-rotulo text-[11px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink"
                >
                  {c.activa ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setABorrar(c.id);
                  }}
                  aria-label="Eliminar"
                  className="cursor-pointer text-gray-45 hover:text-marca"
                >
                  <IconoPapelera className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="nota mt-4 max-w-[68ch]">
        La credencial se guarda en el servidor y no vuelve a mostrarse. Para
        cambiarla, cargá una nueva sobre la cuenta.
      </p>

      <Modal
        abierto={!!aBorrar}
        alCerrar={() => setABorrar(null)}
        eyebrow="Cuentas de pago"
        titulo="Eliminar la cuenta"
      >
        <p className="text-[14px] leading-relaxed text-gray-70">
          Se borra la cuenta y su credencial. Los grupos que la usen tienen que
          reasignarse primero.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Boton variante="fantasma" onClick={() => setABorrar(null)}>
            Cancelar
          </Boton>
          <button
            type="button"
            onClick={() => aBorrar && eliminar.mutate({ id: aBorrar })}
            disabled={eliminar.isPending}
            className="inline-flex items-center gap-2 border border-marca bg-marca px-[22px] py-[13px] font-rotulo text-[13px] uppercase tracking-[0.04em] text-paper transition-colors hover:bg-transparent hover:text-marca disabled:opacity-40"
          >
            <IconoPapelera />
            {eliminar.isPending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </Modal>
    </>
  );
}

function FormularioCuenta({
  alCerrar,
  alCrear,
}: {
  alCerrar: () => void;
  alCrear: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [proveedor, setProveedor] = useState<Proveedor>("TALO");
  const [credencial, setCredencial] = useState("");
  const [apiUrl, setApiUrl] = useState("");

  const crear = api.cuentaPago.crear.useMutation({ onSuccess: alCrear });

  return (
    <div className="mb-8 border border-ink p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          label="Nombre"
          placeholder="Talo — Halley principal"
          hint="Con qué la vas a reconocer en la lista."
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <label className="flex flex-col gap-1.5">
          <span className="font-rotulo text-[10.5px] uppercase tracking-[0.06em] text-gray-70">
            Proveedor
          </span>
          <select
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value as Proveedor)}
            className="border border-ink bg-lienzo px-3 py-[11px] text-[14px]"
          >
            {PROVEEDORES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <Campo
          label={proveedor === "TALO" ? "API key de Talo" : "Access token de Mercado Pago"}
          type="password"
          placeholder="••••••••••••"
          hint="Se guarda en el servidor y no vuelve a mostrarse."
          value={credencial}
          onChange={(e) => setCredencial(e.target.value)}
        />

        {proveedor === "TALO" && (
          <Campo
            label="API URL (opcional)"
            type="url"
            placeholder="https://api.talo.com.ar"
            hint="Sólo si apuntás a otro entorno."
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
        )}
      </div>

      {crear.isError && (
        <p className="nota mt-4 text-marca">{crear.error.message}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Boton
          onClick={() =>
            crear.mutate({
              nombre,
              proveedor,
              credencial,
              apiUrl: apiUrl || undefined,
            })
          }
          disabled={nombre.length < 2 || credencial.length < 8 || crear.isPending}
        >
          {crear.isPending ? "Guardando…" : "Guardar cuenta"}
        </Boton>
        <Boton variante="fantasma" onClick={alCerrar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
