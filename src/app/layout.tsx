import "~/styles/globals.css";

import { type Metadata } from "next";
import { Bebas_Neue, Fraunces, Inter, JetBrains_Mono } from "next/font/google";

import { scriptTema } from "./_components/tema";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Halley Producciones",
  description: "Cobros a grupos de padres — Halley Producciones",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
});

/** Rótulos en versalitas. Sólo trae mayúsculas: no usarla para texto corrido. */
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable} ${bebas.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica el tema guardado antes de pintar, para que no haya destello. */}
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
