import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_ADMIN, cookieValida } from "~/server/auth";
import { vincularConCodigo } from "~/server/mercadopago/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vuelta de Mercado Pago después de que el socio autoriza.
 *
 * Dos llaves, no una: la sesión de admin —porque esto se hace desde el panel y
 * nadie de afuera tiene por qué poder enganchar cuentas— y el `state`, que
 * prueba que este código corresponde a una vinculación que arrancamos nosotros.
 * Sin el `state`, alguien podría hacernos canjear un código propio y quedar
 * cobrando en su cuenta.
 */
export async function GET(req: NextRequest) {
  const volver = (estado: string) =>
    NextResponse.redirect(new URL(`/admin/cuentas?mp=${estado}`, req.url));

  if (!cookieValida(req.cookies.get(COOKIE_ADMIN)?.value)) {
    return volver("sin-sesion");
  }

  const params = req.nextUrl.searchParams;

  // El socio puede cancelar en la pantalla de MP.
  if (params.get("error")) return volver("cancelado");

  const codigo = params.get("code");
  const estado = params.get("state");
  if (!codigo || !estado) return volver("incompleto");

  const res = await vincularConCodigo(codigo, estado);
  if (!res.ok) return volver(res.motivo);

  return volver(res.revinculada ? "revinculada" : "vinculada");
}
