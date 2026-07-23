import {
  Bloque,
  EsqueletoEncabezado,
  EsqueletoTira,
  Linea,
} from "~/app/_components/esqueleto";

/**
 * El esqueleto de cada pantalla del panel.
 *
 * Cada uno copia la estructura real de su página —las mismas cajas, los mismos
 * bordes, los mismos altos— para que al llegar los datos nada se mueva de
 * lugar. Un esqueleto genérico ahorraría código y arruinaría justamente eso.
 *
 * Se usan en dos momentos distintos: como `loading.tsx` de la ruta, que Next
 * muestra apenas se toca el link, y adentro del componente mientras corre la
 * consulta. Es el mismo dibujo en los dos casos, así que la transición entre
 * uno y otro no se nota.
 */

/**
 * `soloTarjetas` es para cuando el esqueleto se usa adentro del componente: ahí
 * el encabezado ya está escrito de verdad y dibujarlo en gris sería un paso
 * atrás.
 */
export function EsqueletoGrupos({
  soloTarjetas = false,
}: {
  soloTarjetas?: boolean;
}) {
  return (
    <>
      {!soloTarjetas && <EsqueletoEncabezado />}

      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="border border-ink">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-20 px-6 py-5">
              <div>
                <Linea className="h-5 w-56" />
                <Linea className="mt-2.5 h-3 w-64" />
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: 6 }, (_, j) => (
                  <Bloque key={j} className="h-4 w-4 rounded-none" />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap">
              {Array.from({ length: 4 }, (_, j) => (
                <div
                  key={j}
                  className="min-w-[130px] flex-1 border-r border-gray-20 px-4 py-3.5 last:border-r-0"
                >
                  <Linea className="h-2.5 w-16" />
                  <Linea className="mt-2.5 h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function EsqueletoDetalle() {
  return (
    <>
      <Linea className="mb-6 h-3 w-20" />
      <EsqueletoEncabezado />

      <div className="mb-8">
        <EsqueletoTira />
      </div>

      {/* La tarjeta del plan */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border border-ink px-6 py-5">
        <div>
          <Linea className="h-2.5 w-32" />
          <Linea className="mt-3 h-7 w-56" />
          <Linea className="mt-3 h-3 w-72" />
        </div>
        <div className="text-right">
          <Linea className="ml-auto h-2.5 w-28" />
          <Linea className="mt-2.5 ml-auto h-6 w-32" />
        </div>
      </div>

      {/* La tabla de alumnos */}
      <div className="border border-ink">
        <div className="border-b border-ink px-3.5 py-3">
          <Linea className="h-3 w-full max-w-[420px]" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-b border-gray-20 px-3.5 py-4 last:border-b-0"
          >
            <Linea className="h-3 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <Linea className="h-3.5 w-40" />
              <Linea className="mt-2 h-2.5 w-52" />
            </div>
            <Linea className="hidden h-3 w-28 shrink-0 sm:block" />
            <div className="hidden shrink-0 gap-1 md:flex">
              {Array.from({ length: 6 }, (_, j) => (
                <Bloque key={j} className="h-4 w-4" />
              ))}
            </div>
            <Bloque className="h-8 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </>
  );
}

/** El resumen de Contenidos: cuatro tarjetas de categoría con su tira de preview. */
export function EsqueletoContenidos() {
  return (
    <>
      <EsqueletoEncabezado />
      <div className="grid gap-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border border-ink">
            <div className="flex items-center justify-between border-b border-gray-20 px-5 py-4">
              <Linea className="h-6 w-40" />
              <Bloque className="h-8 w-20" />
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 sm:grid-cols-5">
              {Array.from({ length: 5 }, (_, j) => (
                <Bloque key={j} className="aspect-square w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** El formulario de ajustes. */
export function EsqueletoAjustes() {
  return (
    <div className="max-w-[560px] border border-ink p-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mb-5">
          <Linea className="h-2.5 w-28" />
          <Bloque className="mt-2 h-11 w-full" />
          <Linea className="mt-2 h-2.5 w-56" />
        </div>
      ))}
      <Bloque className="mt-2 h-11 w-32" />
    </div>
  );
}

/** La grilla de una galería. */
export function EsqueletoGaleria() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 15 }, (_, i) => (
        <Bloque key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}

export function EsqueletoBandeja({
  soloLista = false,
}: {
  soloLista?: boolean;
}) {
  return (
    <>
      {!soloLista && <EsqueletoEncabezado />}

      <div className="border border-ink">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-3 border-b border-gray-20 px-4 py-3.5 last:border-b-0"
          >
            <Bloque className="h-6 w-24 shrink-0" />
            <Linea className="h-3 w-48" />
            <Linea className="ml-auto h-2.5 w-28" />
          </div>
        ))}
      </div>
    </>
  );
}
