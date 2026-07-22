import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

/**
 * Capa de almacenamiento en S3.
 *
 * Extraída del sistema de media-seller-platform y recortada a lo que Halley
 * usa: subir contenido de la vitrina y volver a leerlo. El patrón es el de
 * siempre — el navegador pide una URL firmada y hace el PUT directo a S3, sin
 * que el archivo pase por nuestro servidor.
 *
 * Todo cuelga de `AWS_S3_PREFIX`: es la carpeta de este cliente adentro del
 * bucket. Cambiar esa variable manda las fotos de Halley a su propio rincón sin
 * pisar las de nadie más.
 */

let cliente: S3Client | null = null;

function s3(): S3Client {
  if (!cliente) {
    cliente = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
      // Sin esto el SDK agrega un checksum CRC32 a la URL firmada que el
      // navegador no puede recalcular, y S3 rechaza el PUT con 403.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return cliente;
}

const bucket = () => env.AWS_S3_BUCKET ?? "";

/** Prefijo de carpeta, con la barra final asegurada. */
const prefijo = env.AWS_S3_PREFIX ? env.AWS_S3_PREFIX.replace(/\/?$/, "/") : "";

/** Antepone el prefijo del cliente a una key relativa. */
function conPrefijo(key: string) {
  if (key.startsWith(prefijo)) return key;
  return `${prefijo}${key}`;
}

/** ¿Están las variables para operar contra S3? Si no, la subida se apaga sola. */
export function s3Configurado() {
  return Boolean(
    bucket() && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY,
  );
}

/**
 * URL firmada para que el navegador suba el archivo directo a S3.
 *
 * El cliente TIENE que mandar el mismo Content-Type que se firmó acá, o S3
 * rechaza con 403.
 */
export async function urlDeSubida(
  key: string,
  contentType: string,
  expiraSeg = 300,
) {
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: conPrefijo(key),
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: expiraSeg });
  return { url, key };
}

/** URL firmada de lectura, para mostrar un objeto sin hacerlo público. */
export async function urlDeLectura(key: string, expiraSeg = 3600) {
  if (!key || !bucket()) return null;
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: conPrefijo(key) });
  return getSignedUrl(s3(), cmd, { expiresIn: expiraSeg });
}

/** Borra objetos. Ignora entradas vacías. */
export async function borrarObjetos(keys: string[]) {
  const objetivos = keys.filter(Boolean);
  await Promise.all(
    objetivos.map((k) =>
      s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: conPrefijo(k) })),
    ),
  );
}

/** True si el objeto existe. False ante cualquier error, incluido el 404. */
export async function objetoExiste(key: string) {
  try {
    await s3().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: conPrefijo(key) }),
    );
    return true;
  } catch {
    return false;
  }
}
