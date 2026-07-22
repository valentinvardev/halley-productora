import {
  Bloque,
  EsqueletoTira,
  Linea,
} from "~/app/_components/esqueleto";

/**
 * El panel de la familia también se arma en el servidor —sesión más plan de
 * cada hijo—, así que al volver del pago hay un momento sin nada. Esto ocupa
 * ese momento con la forma del panel, barra de arriba incluida: si el
 * esqueleto no la dibujara, el encabezado aparecería después y empujaría todo
 * hacia abajo.
 */
export default function Cargando() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-gray-20 bg-paper/95">
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-6 sm:px-8">
          <Linea className="h-4 w-20" />
          <div className="flex items-center gap-5">
            <Bloque className="h-4 w-4" />
            <Bloque className="h-4 w-4" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 py-10">
        <Linea className="h-2.5 w-56" />
        <Linea className="mt-3 h-7 w-52" />

        <div className="mt-6">
          <EsqueletoTira celdas={3} />
        </div>

        {/* La tarjeta de la cuota que toca pagar */}
        <div className="mt-6 border border-ink p-6">
          <Linea className="h-2.5 w-52" />
          <Linea className="mt-2.5 h-8 w-40" />
          <div className="mt-5 flex flex-wrap gap-3">
            <Bloque className="h-11 w-44" />
            <Bloque className="h-11 w-44" />
          </div>
          <Linea className="mt-5 h-3 w-full max-w-[46ch]" />
        </div>

        <Linea className="mt-10 h-4 w-28" />
        <div className="mt-3 border border-ink">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-gray-20 px-4 py-3.5 last:border-b-0"
            >
              <Bloque className="h-6 w-6 shrink-0" />
              <Linea className="h-3 w-14 shrink-0" />
              <Linea className="h-3 w-24" />
              <Linea className="ml-auto h-2.5 w-28" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
