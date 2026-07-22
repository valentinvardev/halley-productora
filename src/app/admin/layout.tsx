import { cookies } from "next/headers";

import { Barra } from "~/app/_components/barra";
import { itemCajon } from "~/app/_components/cajon";
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
      <Barra
        href="/admin"
        enlaces={[
          { href: "/admin", texto: "Grupos" },
          { href: "/admin/notificaciones", texto: "Bandeja" },
        ]}
        identidad={{
          titulo: "Panel de Halley",
          detalle: "Sesión de administración",
        }}
        salir={
          <form action={cerrarSesion}>
            <button type="submit" className={`${itemCajon} text-gray-45`}>
              Salir
            </button>
          </form>
        }
      />

      <main className="mx-auto max-w-[1080px] px-6 py-12 sm:px-8">
        {children}
      </main>
    </div>
  );
}
