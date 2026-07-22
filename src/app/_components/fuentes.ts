import { Bebas_Neue, Montserrat } from "next/font/google";

/**
 * Las tipografías del manual de marca.
 *
 * Se cargan acá y no en el layout raíz porque sólo las usa el sitio público:
 * no tiene sentido que el panel se baje dos familias que no va a pintar.
 *
 * Y viven en su propio módulo, no en una página, porque un archivo `page.tsx`
 * sólo puede exportar lo que Next espera de una página —`metadata`, `default`
 * y poco más—; cualquier otro export rompe el build.
 */

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
});

/** Va en el contenedor de la página, junto con `landing`. */
export const FUENTES_MARCA = `${bebas.variable} ${montserrat.variable}`;
