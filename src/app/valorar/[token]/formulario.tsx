"use client";

import { useState } from "react";

import { IconoEstrella } from "~/app/_components/iconos";
import { Boton, Campo, CampoTexto, Etiqueta } from "~/app/_components/ui";
import { api } from "~/trpc/react";

/**
 * El formulario de la valoración: estrellas, nombre, comentario y foto.
 *
 * La foto sube directo a S3 con una URL firmada atada al link, igual que las
 * subidas del panel: el archivo no pasa por nuestro servidor. Si la subida
 * falla, la valoración sale igual sin foto; la foto es lo de menos.
 */
export function FormularioValoracion({ token }: { token: string }) {
  const [estrellas, setEstrellas] = useState(0);
  const [sobre, setSobre] = useState(0);
  const [nombre, setNombre] = useState("");
  const [comentario, setComentario] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const firmar = api.valoracion.urlDeSubidaFoto.useMutation();
  const enviar = api.valoracion.enviar.useMutation({
    onSuccess: (r) => {
      if (r.ok) setListo(true);
      else setError("El link ya no sirve.");
    },
    onError: (e) => setError(e.message),
  });

  const ocupado = subiendo || enviar.isPending;
  const puede =
    estrellas > 0 &&
    nombre.trim().length >= 2 &&
    comentario.trim().length >= 10;

  async function mandar() {
    setError(null);
    let fotoKey: string | undefined;
    if (foto) {
      setSubiendo(true);
      try {
        const { url, key } = await firmar.mutateAsync({
          token,
          contentType: foto.type,
        });
        const r = await fetch(url, {
          method: "PUT",
          body: foto,
          headers: { "Content-Type": foto.type },
        });
        if (r.ok) fotoKey = key;
      } catch {
        // Sin foto entonces. La valoración vale igual.
      } finally {
        setSubiendo(false);
      }
    }
    enviar.mutate({
      token,
      nombre: nombre.trim(),
      comentario: comentario.trim(),
      estrellas,
      fotoKey,
    });
  }

  if (listo) {
    return (
      <div className="mt-10 border border-ink p-6">
        <p className="font-titulo text-[1.6rem] uppercase leading-tight">
          ¡Gracias!
        </p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-gray-70">
          Ya nos llegó. Si la publicamos, va a aparecer en la web con tu nombre.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-6">
      <div>
        <Etiqueta>¿Cuántas estrellas?</Etiqueta>
        <div className="mt-2 flex gap-1" onMouseLeave={() => setSobre(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEstrellas(n)}
              onMouseEnter={() => setSobre(n)}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={estrellas === n}
              className="cursor-pointer p-1"
            >
              <IconoEstrella
                className={`h-8 w-8 transition-colors ${
                  n <= (sobre || estrellas) ? "text-ink" : "text-gray-20"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <Campo
        label="Tu nombre"
        placeholder="Ana Pérez"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        hint="Así va a salir en la web."
      />

      <CampoTexto
        label="Cómo la pasaron"
        rows={5}
        placeholder="Qué te gustó, qué te sorprendió, qué le dirías a otra familia."
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        hint="Al menos unas diez palabras."
      />

      <label className="flex flex-col gap-1.5">
        <Etiqueta>Tu foto (opcional)</Etiqueta>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          className="text-[13px] file:mr-3 file:cursor-pointer file:border file:border-ink file:bg-paper file:px-3 file:py-2 file:font-rotulo file:text-[11.5px] file:uppercase file:tracking-[0.06em]"
        />
        <span className="nota text-[11.5px] text-gray-45">
          JPG, PNG o WebP. Sale al lado de tu nombre.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={mandar} disabled={!puede || ocupado}>
          {subiendo
            ? "Subiendo la foto…"
            : enviar.isPending
              ? "Enviando…"
              : "Enviar"}
        </Boton>
        {error && <span className="nota text-[12px] text-marca">{error}</span>}
      </div>
    </div>
  );
}
