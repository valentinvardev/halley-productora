"use client";

import { FUENTES_MARCA } from "~/app/_components/fuentes";
import { IconoAlerta, IconoDescargar } from "~/app/_components/iconos";
import { Modal } from "~/app/_components/modal";
import { botonFantasma } from "~/app/_components/ui";
import { Hoja } from "~/app/presupuesto/_componentes/hoja";
import { api } from "~/trpc/react";

/**
 * El presupuesto emitido, mirado desde el panel.
 *
 * Antes esto era un link a la página pública en otra pestaña, y eso tenía dos
 * costos: uno se iba del panel y volvía perdiendo el lugar en la lista, y lo
 * que veía era la página —con su barra, su "generado con éxito" y sus botones—
 * en vez del documento.
 *
 * Acá se ve la hoja tal como sale impresa. Es literalmente el mismo componente
 * que usa la página pública, con el membrete y el pie destapados: no es una
 * vista previa parecida al PDF, es el PDF.
 *
 * El fondo se desenfoca fuerte. Detrás hay una tabla llena de números y otro
 * documento lleno de números, y sin eso los de atrás compiten con los de
 * adelante justo cuando uno está tratando de leer una cifra.
 */
export function VerPresupuesto({
  codigo,
  alCerrar,
}: {
  /** `null` cierra el modal. */
  codigo: string | null;
  alCerrar: () => void;
}) {
  const abierto = codigo !== null;

  const presupuesto = api.presupuesto.porCodigo.useQuery(
    { codigo: codigo ?? "" },
    { enabled: abierto },
  );
  const contacto = api.ajuste.obtener.useQuery(undefined, { enabled: abierto });
  const parametros = api.catalogo.parametros.useQuery(undefined, {
    enabled: abierto,
  });

  // Las tres consultas o están las tres o no está ninguna: la hoja necesita el
  // presupuesto, los datos de contacto del pie y las reglas con las que se
  // recalcula el cierre, y con una a medias mostraría números incompletos.
  const p = presupuesto.data;
  const listo = p && contacto.data && parametros.data;

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      eyebrow={codigo ?? undefined}
      titulo="Presupuesto"
      // Un documento a 560px se lee como una tira: la hoja tiene dos columnas y
      // necesita el ancho de una hoja.
      ancho="w-[min(940px,calc(100vw-2rem))]"
    >
      {presupuesto.isPending || contacto.isPending || parametros.isPending ? (
        <p className="nota">Cargando…</p>
      ) : presupuesto.error ? (
        <p className="flex items-start gap-2 text-[13.5px] text-gray-70">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          No se pudo abrir este presupuesto.
        </p>
      ) : listo ? (
        <>
          {/* `landing` trae la paleta y las medidas de la marca, que es contra
              lo que está diseñado el documento —el panel tiene las suyas y acá
              serían las equivocadas—, y `FUENTES_MARCA` las tipografías, que el
              panel no carga porque no las usa en ninguna otra pantalla. Sin
              ellas el documento se vería con la sustituta del sistema, que es
              justo lo que una vista previa no puede hacer.
              `como-documento` fuerza el papel blanco: una hoja no sigue el tema
              de quien la mira. */}
          <div className={`landing ${FUENTES_MARCA}`}>
            <div className="hoja como-documento p-7 sm:p-9">
              <Hoja
                p={p}
                parametros={parametros.data}
                contacto={contacto.data}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {/* Imprimir desde acá saldría con el panel entero detrás, así que
                la descarga se hace donde la hoja es la página. */}
            <a
              href={`/presupuesto/codigo/${encodeURIComponent(p.codigo)}`}
              target="_blank"
              rel="noreferrer"
              className={botonFantasma}
            >
              <IconoDescargar />
              Abrir para imprimir
            </a>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
