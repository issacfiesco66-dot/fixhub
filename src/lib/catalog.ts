// Helpers compartidos para el CRUD de catálogo (services, categories, brands, cities).

import { Prisma } from "@prisma/client";
import { slugify } from "./utils";

/**
 * Garantiza un slug único. Si `desired` ya existe, prueba `desired-2`, `desired-3`…
 *
 * @param name     texto base (se slugifica si no se pasó un slug explícito)
 * @param explicit slug explícito del usuario (ya validado [a-z0-9-]); si viene, no se slugifica
 * @param exists   callback que devuelve true si el slug ya está tomado
 */
export async function ensureUniqueSlug(
  name: string,
  explicit: string | undefined,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = (explicit && explicit.trim()) || slugify(name);
  if (!base) throw new Error("No se pudo generar un slug a partir del nombre");
  let slug = base;
  let n = 2;
  while (await exists(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/**
 * Detecta el error de FK de Prisma (P2003) o "required relation" (P2014):
 * intentar borrar un registro del que dependen otras filas. La UI lo traduce
 * a "desactiva en lugar de borrar".
 */
export function isForeignKeyError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2003" || e.code === "P2014")
  );
}

/** Detecta violación de unique constraint (P2002) — slug duplicado en carrera. */
export function isUniqueError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
