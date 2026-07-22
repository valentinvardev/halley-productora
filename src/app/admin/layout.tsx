import Link from "next/link";
import { cookies } from "next/headers";

import { BotonTema } from "~/app/_components/tema";
import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { cerrarSesion } from "./acciones";
import { Login } from "./_components/login";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const galleta = await cookies();

  if (!cookieValida(galleta.get(COOKIE_ADMIN)?.value)) {
    return <Login />;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-gray-20 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-8">
          <Link href="/admin" className="font-display text-[15px] font-semibold">
            Halley — panel
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-rotulo text-[13px] uppercase tracking-[0.06em] text-gray-70 hover:text-ink"
            >
              Grupos
            </Link>
            <Link
              href="/admin/notificaciones"
              className="font-rotulo text-[13px] uppercase tracking-[0.06em] text-gray-70 hover:text-ink"
            >
              Bandeja
            </Link>
            <BotonTema />
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="cursor-pointer font-rotulo text-[13px] uppercase tracking-[0.06em] text-gray-45 hover:text-ink"
              >
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-8 py-12">{children}</main>
    </div>
  );
}
