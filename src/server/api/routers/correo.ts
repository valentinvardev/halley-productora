import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { dominioDelRemitente } from "~/app/_datos/correo";
import { env } from "~/env";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  chequeoCasilla,
  chequeoDkim,
  chequeoDmarc,
  chequeoEntregas,
  direccionesConProblema,
  dominioRaiz,
  mx,
  revisarRegistro,
  type Chequeo,
} from "~/server/correo-salud";
import { guardarCorreo, leerCorreo } from "~/server/correo-ajustes";
import { clienteResend, responderA } from "~/server/email";
import { remitentes } from "~/server/entrega";
import { CALENTAMIENTO, RITMO_POR_DEFECTO, estimarCola } from "~/server/ritmo";
import { casillaDeAvisos } from "~/server/notificaciones";

/**
 * Dominios y entrega: lo que decide si un correo de Halley llega a la bandeja
 * de entrada o al spam.
 *
 * Los dominios se administran en Resend y el DNS en Cloudflare; esta pantalla
 * no reemplaza a ninguno de los dos. Lo que hace es juntar en un lugar lo que
 * hoy hay que ir a mirar a tres, y comparar lo que Resend espera con lo que
 * está publicado de verdad, que es donde aparecen los problemas que ninguno de
 * los dos paneles muestra.
 */

/** Lo que dice Resend cuando la clave no alcanza, en castellano. */
function mensajeDeResend(error: { name: string; message: string }) {
  if (error.name === "restricted_api_key") {
    return "La clave de Resend del servidor sólo puede mandar correos. Para ver y agregar dominios desde acá hace falta una con acceso completo.";
  }
  return error.message;
}

/** Lo que Halley le pide a Resend que le avise. */
const EVENTOS = [
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.delivery_delayed",
  "email.failed",
] as const;

const urlDelWebhook = () =>
  `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/resend`;

async function dominiosDeResend() {
  const api = clienteResend();
  if (!api) return { clave: "sin-clave" as const, error: null, dominios: [] };

  const { data, error } = await api.domains.list();
  if (error) {
    return {
      clave:
        error.name === "restricted_api_key"
          ? ("restringida" as const)
          : ("error" as const),
      error: mensajeDeResend(error),
      dominios: [],
    };
  }

  const dominios = await Promise.all(
    data.data.map(async (d) => {
      const { data: detalle } = await api.domains.get(d.id);
      const registros = await Promise.all(
        (detalle?.records ?? [])
          // Los de recibir correo y los de seguimiento de clics no hacen al envío.
          .filter((r) => r.record === "DKIM" || r.record === "SPF")
          .map((r) => revisarRegistro(r, d.name)),
      );
      return {
        id: d.id,
        nombre: d.name,
        estado: d.status,
        region: d.region,
        creado: d.created_at,
        registros,
      };
    }),
  );
  return { clave: "completa" as const, error: null, dominios };
}

export const correoRouter = createTRPCRouter({
  estado: adminProcedure.query(async () => {
    const enUso = await remitentes();
    const ajustes = await leerCorreo();
    const resend = await dominiosDeResend();
    // Los dominios desde los que sale algo hoy: uno, o dos si los masivos
    // tienen el suyo. Cada uno se revisa por separado.
    const dominiosEnUso = [
      ...new Set([enUso.avisos, enUso.masivos].map(dominioDelRemitente)),
    ];

    const salud: Chequeo[] = [];
    const raicesVistas = new Set<string>();

    for (const dominio of dominiosEnUso) {
      const remitente = [enUso.avisos, enUso.masivos].find(
        (r) => dominioDelRemitente(r) === dominio,
      )!;
      const propio = resend.dominios.find((d) => d.nombre === dominio);
      if (dominio === "resend.dev") {
        salud.push({
          clave: `remitente:${dominio}`,
          titulo: "Desde qué dirección salen",
          estado: "problema",
          detalle: `Salen desde ${remitente}, la dirección de prueba de Resend: sólo puede escribirle a la casilla dueña de la cuenta.`,
          arreglo:
            "Verificá el dominio de Halley en Resend y poné una dirección suya en EMAIL_FROM.",
        });
      } else {
        const dkim = await chequeoDkim(
          dominio,
          propio?.registros.find((r) => r.proposito === "DKIM")?.valor ?? null,
        );
        salud.push({ ...dkim, clave: `dkim:${dominio}` });

        // Los registros de envío (SPF) se revisan con lo que espera Resend; sin
        // acceso a los dominios no hay contra qué comparar.
        if (propio) {
          const spf = propio.registros.filter((r) => r.proposito === "SPF");
          const mal = spf.filter(
            (r) => r.coincide === false || r.sobrantes.length > 0,
          );
          salud.push(
            mal.length
              ? {
                  clave: `spf:${dominio}`,
                  titulo: `Registros de envío de ${dominio}`,
                  estado: "problema",
                  detalle: `${mal.map((r) => `${r.tipo} de ${r.nombre}`).join(" y ")} no coincide con lo que espera Resend.`,
                  arreglo:
                    "Cargá en el DNS los valores que figuran abajo, en Dominios.",
                }
              : {
                  clave: `spf:${dominio}`,
                  titulo: `Registros de envío de ${dominio}`,
                  estado: "bien",
                  detalle:
                    "El MX y el SPF del subdominio de rebotes están publicados como los espera Resend.",
                },
          );
        }

        // DMARC y la casilla son de la raíz: dos subdominios de Halley
        // comparten las dos cosas y se revisan una sola vez.
        const raiz = dominioRaiz(dominio);
        if (raicesVistas.has(raiz)) continue;
        raicesVistas.add(raiz);

        salud.push(await chequeoDmarc(dominio));

        // Se mira el MX y no si "recibe": la raíz tiene la dirección de la web, y
        // eso alcanza para que un servidor intente entregarle, pero ahí no hay
        // nadie escuchando correo.
        const buzones = await mx(raiz);
        if (buzones !== null && buzones.length === 0) {
          salud.push({
            clave: "buzon",
            titulo: `Casilla en ${raiz}`,
            estado: "atencion",
            detalle: `${raiz} no recibe correo, así que el remitente (${remitente}) no existe como casilla. Para un filtro, un dominio que manda y no puede recibir es una señal en contra, y los reportes de DMARC no tienen dónde llegar.`,
            arreglo: `En Cloudflare, Correo electrónico > Email Routing recibe en cualquier dirección de ${raiz} y la reenvía a la casilla que elijan. Es gratis y no toca nada de Resend: Resend vive en el subdominio send y en resend._domainkey.`,
          });
        }
      }
    }

    salud.push(
      await chequeoCasilla(
        "respuestas",
        "A dónde contestan las familias",
        responderA,
        "cuando una familia responde un correo, la respuesta rebota y nadie se entera.",
        "En el servidor, poné EMAIL_REPLY_TO con una casilla que exista y reiniciá.",
      ),
      await chequeoCasilla(
        "avisos",
        "A dónde le llegan a Halley los avisos de pagos",
        await casillaDeAvisos(),
        "los avisos de pago recibido, pago incompleto y plan terminado no salen.",
        "En Ajustes, completá Email de avisos con la casilla donde los quieran recibir.",
      ),
    );

    const webhook = {
      conectado: !!(ajustes.webhookSecreto || env.RESEND_WEBHOOK_SECRET),
      /** Si lo creó el botón del panel o alguien a mano con la variable. */
      origen: ajustes.webhookSecreto
        ? ("panel" as const)
        : env.RESEND_WEBHOOK_SECRET
          ? ("entorno" as const)
          : null,
      url: urlDelWebhook(),
    };
    salud.push(
      await chequeoEntregas(webhook.conectado, resend.clave === "completa"),
    );

    const direcciones = await direccionesConProblema();
    const noReciben = direcciones.filter(
      (d) => d.motivo !== "parece-mal-escrita",
    ).length;
    salud.push(
      direcciones.length
        ? {
            clave: "direcciones",
            titulo: "Direcciones de las familias",
            estado: noReciben ? "problema" : "atencion",
            detalle:
              (noReciben
                ? `${noReciben} no pueden recibir correo: rebotaron, se quejaron o el dominio no existe. `
                : "") +
              (direcciones.length - noReciben
                ? `${direcciones.length - noReciben} se parecen demasiado a un proveedor conocido para ser reales. `
                : "") +
              "Los correos a direcciones mal escritas rebotan o, peor, le llegan a un tercero.",
            arreglo:
              "Están listadas abajo con el alumno y el curso. Corregilas desde la ficha del alumno.",
          }
        : {
            clave: "direcciones",
            titulo: "Direcciones de las familias",
            estado: "bien",
            detalle:
              "Todas tienen un dominio que recibe correo y ninguna parece mal escrita.",
          },
    );

    const cola = await estimarCola(enUso.masivos, 1);

    return {
      ritmo: {
        porHora: cola.ritmo,
        porDefecto: RITMO_POR_DEFECTO,
        calentamiento: cola.calentamiento?.dia
          ? {
              dominio: cola.calentamiento.dominio,
              ...CALENTAMIENTO[cola.calentamiento.dia - 1]!,
            }
          : null,
      },
      remitentes: {
        ...enUso,
        /** Si se eligieron en el panel o salen de EMAIL_FROM. */
        avisosElegido: !!ajustes.remitenteAvisos,
        masivosElegido: !!ajustes.remitenteMasivos,
        porDefecto: env.EMAIL_FROM,
      },
      dominio: dominioDelRemitente(enUso.avisos),
      clave: resend.clave,
      errorClave: resend.error,
      dominios: resend.dominios,
      salud,
      direcciones,
      webhook,
    };
  }),

  /** Cuántos correos en masa por hora. 0 es sin ritmo: todos de una. */
  guardarRitmo: adminProcedure
    .input(z.object({ porHora: z.number().int().min(0).max(1000) }))
    .mutation(async ({ input }) => {
      await guardarCorreo({ ritmo: String(input.porHora) });
      return { ok: true };
    }),

  /**
   * Elige desde qué dirección salen los avisos o los envíos en masa.
   *
   * Sólo deja elegir un dominio verificado en Resend: con uno que no lo esté,
   * Resend rechaza cada correo, y el primero en enterarse sería una familia que
   * no recibió su link para entrar. `null` vuelve al de siempre.
   */
  guardarRemitente: adminProcedure
    .input(
      z.object({
        para: z.enum(["avisos", "masivos"]),
        remitente: z
          .object({
            nombre: z
              .string()
              .trim()
              .min(1)
              .max(60)
              .regex(/^[^<>"@]+$/, 'El nombre no puede tener < > " ni @.'),
            local: z
              .string()
              .trim()
              .toLowerCase()
              .regex(
                /^[a-z0-9][a-z0-9._+-]{0,63}$/,
                "La parte antes de la @ sólo puede tener letras, números, punto, guión y +.",
              ),
            dominio: z.string().trim().toLowerCase(),
          })
          .nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const clave =
        input.para === "avisos" ? "remitenteAvisos" : "remitenteMasivos";
      if (!input.remitente) {
        await guardarCorreo({ [clave]: "" });
        return { remitente: null };
      }

      const resend = await dominiosDeResend();
      if (resend.clave !== "completa") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: resend.error ?? "No hay clave de Resend en el servidor.",
        });
      }
      const dominio = resend.dominios.find(
        (d) => d.nombre === input.remitente!.dominio,
      );
      if (!dominio)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ese dominio no está en la cuenta de Resend.",
        });
      if (dominio.estado !== "verified") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${dominio.nombre} todavía no está verificado: Resend rechazaría cada correo.`,
        });
      }

      const remitente = `${input.remitente.nombre} <${input.remitente.local}@${dominio.nombre}>`;
      await guardarCorreo({ [clave]: remitente });
      return { remitente };
    }),

  /**
   * Le pide a Resend que avise de cada entrega, rebote y queja.
   *
   * Crea el webhook con la URL pública de Halley y guarda en la base la clave
   * con que Resend firma cada aviso: es lo que permite que la ruta del webhook
   * le crea. Si ya hay uno creado desde acá y sigue existiendo, no crea otro.
   */
  conectarWebhook: adminProcedure.mutation(async () => {
    const api = clienteResend();
    if (!api)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No hay clave de Resend en el servidor.",
      });

    const url = urlDelWebhook();
    if (
      process.env.NODE_ENV === "production" &&
      /\/\/(localhost|127\.0\.0\.1)/.test(url)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `NEXT_PUBLIC_APP_URL apunta a ${url}: Resend no puede avisarle a una dirección local.`,
      });
    }

    const { webhookId } = await leerCorreo();
    if (webhookId) {
      const { data } = await api.webhooks.get(webhookId);
      if (data) return { yaEstaba: true };
    }

    const { data, error } = await api.webhooks.create({
      endpoint: url,
      events: [...EVENTOS],
    });
    if (error)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: mensajeDeResend(error),
      });
    await guardarCorreo({
      webhookId: data.id,
      webhookSecreto: data.signing_secret,
    });
    return { yaEstaba: false };
  }),

  /**
   * Vuelve a habilitar una dirección bloqueada.
   *
   * Es para cuando la familia arregló su casilla o el rebote fue un error. La
   * saca también de la lista de supresión de Resend: si no, Resend la seguiría
   * frenando de su lado y el correo tampoco saldría.
   */
  desbloquear: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();
      await ctx.db.direccionBloqueada.deleteMany({ where: { email } });

      const api = clienteResend();
      if (!api) return { enResend: "sin-clave" as const };
      const { error } = await api.suppressions.remove(email);
      if (!error) return { enResend: "quitada" as const };
      if (error.name === "not_found") return { enResend: "no-estaba" as const };
      return { enResend: "error" as const, error: mensajeDeResend(error) };
    }),

  /**
   * Agrega un dominio o subdominio en Resend.
   *
   * Nace sin verificar: Resend devuelve los registros, alguien los carga en el
   * DNS y recién ahí se verifica. Va a la misma región que los que ya hay, que
   * es São Paulo: la más cerca de las familias y la que ya tiene historial.
   */
  agregarDominio: adminProcedure
    .input(
      z.object({
        nombre: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
            "No es un dominio válido.",
          ),
      }),
    )
    .mutation(async ({ input }) => {
      const api = clienteResend();
      if (!api)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No hay clave de Resend en el servidor.",
        });

      const { data: lista } = await api.domains.list();
      const region = lista?.data[0]?.region ?? "sa-east-1";
      const { data, error } = await api.domains.create({
        name: input.nombre,
        region,
      });
      if (error)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: mensajeDeResend(error),
        });
      return { id: data.id };
    }),

  /** Le pide a Resend que vuelva a mirar el DNS de un dominio. */
  verificarDominio: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const api = clienteResend();
      if (!api)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No hay clave de Resend en el servidor.",
        });
      const { error } = await api.domains.verify(input.id);
      if (error)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: mensajeDeResend(error),
        });
      return { ok: true };
    }),
});
