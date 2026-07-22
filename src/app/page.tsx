import Link from "next/link";

import { Marca } from "./_components/marca";
import { BotonTema } from "./_components/tema";
import { botonFantasma, botonSolido } from "./_components/ui";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1080px] px-8">
      <section className="border-b border-gray-20 py-24">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="eyebrow">
            Halley Producciones — SurCodia — Demo de cobros
          </div>
          <BotonTema />
        </div>
        <h1 className="max-w-[11ch] text-[56px] leading-[0.98]">
          Hoja de contacto
        </h1>
        <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-gray-70">
          Cobros a grupos de padres: el administrador arma el grupo, cada padre
          recibe su link personal sin login, y el pago vuelve por webhook y se
          marca solo en el panel. Círculo con tilde es pagado, punteado
          pendiente, tachado vencido.
        </p>

        <div className="mt-10 flex flex-wrap gap-3.5">
          <Link href="/admin" className={botonSolido}>
            Entrar al panel
          </Link>
          <span className={`${botonFantasma} pointer-events-none opacity-40`}>
            Vitrina — próxima etapa
          </span>
        </div>

        <div className="mt-14 flex flex-wrap border-y border-ink">
          {[
            {
              tipo: "confirmado" as const,
              titulo: "Circulado con tilde",
              texto: "Pagado — el pago se acreditó y se avisó por email.",
            },
            {
              tipo: "punteado" as const,
              titulo: "Punteado",
              texto: "Pendiente — el padre todavía no transfirió.",
            },
            {
              tipo: "tachado" as const,
              titulo: "Tachado",
              texto: "Vencido — pasó la fecha límite de la cuota.",
            },
          ].map((m) => (
            <div
              key={m.titulo}
              className="min-w-[200px] flex-1 border-r border-gray-20 py-5 pr-5 last:border-r-0"
            >
              <Marca tipo={m.tipo} className="mb-3 h-8 w-8" />
              <div className="text-[13px] font-medium">{m.titulo}</div>
              <div className="nota mt-1">
                {m.texto}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-9">
        <p className="font-mono text-[11px] text-gray-45">
          HALLEY × SURCODIA — DEMO — 026
        </p>
      </footer>
    </main>
  );
}
