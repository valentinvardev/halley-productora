import { cookies } from "next/headers";

import { Barra } from "~/app/_components/barra";
import { itemCajon } from "~/app/_components/cajon";
import {
  IconoGrupos,
  IconoImagen,
  IconoSobre,
} from "~/app/_components/iconos";
import { SidebarPanel } from "~/app/_components/sidebar-panel";
import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { cerrarSesion } from "./acciones";
import { Login } from "./_components/login";

const ENLACES = [
  { href: "/admin", texto: "Grupos" },
  { href: "/admin/notificaciones", texto: "Bandeja" },
  { href: "/admin/contenidos", texto: "Contenidos" },
];

/** Con ícono, para el sidebar; sin ícono, para la barra móvil. */
const ENLACES_CON_ICONO = [
  { href: "/admin", texto: "Grupos", icono: <IconoGrupos /> },
  { href: "/admin/notificaciones", texto: "Bandeja", icono: <IconoSobre /> },
  { href: "/admin/contenidos", texto: "Contenidos", icono: <IconoImagen /> },
];

const IDENTIDAD = {
  titulo: "Panel de Halley",
  detalle: "Sesión de administración",
};

function BotonSalir() {
  return (
    <form action={cerrarSesion}>
      <button type="submit" className={`${itemCajon} border-b-0 py-0 text-gray-45`}>
        Salir
      </button>
    </form>
  );
}

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
    <div className="min-h-screen lg:flex">
      {/* Escritorio: la navegación siempre a la vista, a la izquierda. */}
      <SidebarPanel
        href="/admin"
        enlaces={ENLACES_CON_ICONO}
        identidad={IDENTIDAD}
        salir={<BotonSalir />}
      />

      <div className="min-w-0 flex-1">
        {/* Pantalla chica: la misma navegación entra por la hamburguesa. */}
        <div className="lg:hidden">
          <Barra
            href="/admin"
            enlaces={ENLACES}
            identidad={IDENTIDAD}
            salir={
              <form action={cerrarSesion}>
                <button type="submit" className={`${itemCajon} text-gray-45`}>
                  Salir
                </button>
              </form>
            }
          />
        </div>

        <main className="mx-auto max-w-[1080px] px-6 py-12 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
