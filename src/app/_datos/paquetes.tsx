import {
  IconoBillete,
  IconoCalendario,
  IconoCampana,
  IconoEstrella,
  IconoGrupos,
  IconoImagen,
  IconoLista,
  IconoObjetivo,
  IconoRegalo,
  IconoReloj,
  IconoReproducir,
  IconoTilde,
} from "~/app/_components/iconos";

import type { Seleccion } from "./presupuesto";

/**
 * Los presupuestos prearmados, del lado que comparten el panel y el wizard.
 *
 * Un paquete es una selección del catálogo con nombre propio: lo que Halley
 * ofrece como "elegí éste" a quien no quiere armar ítem por ítem. No tiene
 * precio guardado: la selección viaja por clave de ítem y el total se calcula
 * en vivo contra el catálogo, con las mismas funciones que usa el wizard. Así
 * un precio que cambia en el catálogo cambia en el paquete, y un ítem que se
 * apaga se cae solo.
 *
 * Este módulo no toca la base: son tipos y el set de íconos. La lectura vive en
 * `server/paquetes.ts`.
 */

export type Paquete = {
  id: string;
  nombre: string;
  texto: string;
  icono: IconoPaquete;
  seleccion: Seleccion;
  /** Ya calculado contra el catálogo, para no repetir la cuenta en cada tarjeta. */
  total: number;
};

/**
 * Los íconos que un paquete puede llevar.
 *
 * Es una lista cerrada y no un nombre libre porque el ícono se guarda en la base
 * como texto, y un texto que no corresponde a nada dejaría la tarjeta sin
 * dibujo. Lo que no esté acá cae a la estrella.
 */
export const ICONOS_PAQUETE = [
  "estrella",
  "regalo",
  "calendario",
  "imagen",
  "reproducir",
  "objetivo",
  "reloj",
  "campana",
  "grupos",
  "billete",
  "lista",
  "tilde",
] as const;

export type IconoPaquete = (typeof ICONOS_PAQUETE)[number];

export function esIconoPaquete(v: string): v is IconoPaquete {
  return (ICONOS_PAQUETE as readonly string[]).includes(v);
}

/** Cómo se le dice a cada uno en el panel, para elegirlo. */
export const NOMBRE_ICONO: Record<IconoPaquete, string> = {
  estrella: "Estrella",
  regalo: "Regalo",
  calendario: "Calendario",
  imagen: "Foto",
  reproducir: "Video",
  objetivo: "Objetivo",
  reloj: "Reloj",
  campana: "Campana",
  grupos: "Gente",
  billete: "Billete",
  lista: "Lista",
  tilde: "Tilde",
};

const DIBUJO: Record<
  IconoPaquete,
  (props: { className?: string }) => React.ReactNode
> = {
  estrella: IconoEstrella,
  regalo: IconoRegalo,
  calendario: IconoCalendario,
  imagen: IconoImagen,
  reproducir: IconoReproducir,
  objetivo: IconoObjetivo,
  reloj: IconoReloj,
  campana: IconoCampana,
  grupos: IconoGrupos,
  billete: IconoBillete,
  lista: IconoLista,
  tilde: IconoTilde,
};

/** El ícono de un paquete por su nombre. Un nombre desconocido dibuja la estrella. */
export function IconoDePaquete({
  icono,
  className,
}: {
  icono: string;
  className?: string;
}) {
  const Dibujo = DIBUJO[esIconoPaquete(icono) ? icono : "estrella"];
  return <Dibujo className={className} />;
}
