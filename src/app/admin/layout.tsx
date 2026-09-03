import { cookies } from "next/headers";

import { Barra } from "~/app/_components/barra";
import { itemCajon } from "~/app/_components/cajon";
import {
  IconoBillete,
  IconoCalculadora,
  IconoCandado,
  IconoEngranaje,
  IconoEstrella,
  IconoGrupos,
  IconoImagen,
  IconoLista,
  IconoSobre,
} from "~/app/_components/iconos";
import { SidebarPanel } from "~/app/_components/sidebar-panel";
import { contacto } from "~/server/ajustes";
import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { cerrarSesion } from "./acciones";
import { AvisoCobros } from "./_components/aviso-cobros";
import { Login } from "./_components/login";

const ENLACES = [
  { href: "/admin", texto: "Grupos" },
  { href: "/admin/transacciones", texto: "Transacciones" },
  { href: "/admin/presupuestos", texto: "Presupuestos" },
  { href: "/admin/notificaciones", texto: "Bandeja" },
  { href: "/admin/contenidos", texto: "Contenidos" },
  { href: "/admin/galerias", texto: "Galerías" },
  { href: "/admin/cuentas", texto: "Cuentas" },
  { href: "/admin/textos", texto: "Textos" },
  { href: "/admin/valoraciones", texto: "Valoraciones" },
  { href: "/admin/ajustes", texto: "Ajustes" },
];

/** Con ícono, para el sidebar; sin ícono, para la barra móvil. */
const ENLACES_CON_ICONO = [
  { href: "/admin", texto: "Grupos", icono: <IconoGrupos /> },
  {
    href: "/admin/transacciones",
    texto: "Transacciones",
    icono: <IconoBillete />,
  },
  {
    href: "/admin/presupuestos",
    texto: "Presupuestos",
    icono: <IconoCalculadora />,
  },
  { href: "/admin/notificaciones", texto: "Bandeja", icono: <IconoSobre /> },
  { href: "/admin/contenidos", texto: "Contenidos", icono: <IconoImagen /> },
  { href: "/admin/galerias", texto: "Galerías", icono: <IconoCandado /> },
  { href: "/admin/cuentas", texto: "Cuentas", icono: <IconoBillete /> },
  { href: "/admin/textos", texto: "Textos", icono: <IconoLista /> },
  {
    href: "/admin/valoraciones",
    texto: "Valoraciones",
    icono: <IconoEstrella />,
  },
  { href: "/admin/ajustes", texto: "Ajustes", icono: <IconoEngranaje /> },
];

const IDENTIDAD = {
  titulo: "Panel de Halley",
  detalle: "Sesión de administración",
};

function BotonSalir() {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className={`${itemCajon} border-b-0 py-0 text-gray-45`}
      >
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
  const ajustes = await contacto();

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

        {/* Sin tope de ancho.

            Cortaba en 1080px, y en un monitor de escritorio el sidebar ya se
            lleva su parte: lo que quedaba era la grilla de contenidos encajonada
            en el medio con el fondo del panel a los costados. En una pantalla de
            fotos eso es espacio que se está tirando, porque lo que se hace ahí es
            mirar muchas a la vez y compararlas.

            Lo que necesita ancho corto no depende de este tope y ya lo resuelve
            cada uno: el encabezado corta su bajada en 62 caracteres, los
            formularios traen su propio ancho y las tablas largas van adentro de
            su scroll horizontal. */}
        <main className="px-6 py-12 sm:px-8">{children}</main>

        {/* Va en el layout y no en una pantalla: el aviso tiene que sonar se
            esté donde se esté dentro del panel. */}
        <AvisoCobros sonido={ajustes.sonidoPago} />
      </div>
    </div>
  );
}
