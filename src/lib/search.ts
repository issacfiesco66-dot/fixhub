// Búsqueda de servicios: normalización + matching contra el catálogo.
//
// Usado por:
//   - /api/search (público — autocomplete del buscador del sitio)
//   - /admin/searches (agrupar queries por normalizedQuery)
//
// Diseño:
//   - normalizeQuery() es la fuente de verdad para dedupe. La MISMA query
//     ("Reparar Lavadora", "reparar  lavadora!", "REPARAR LAVADORA") tiene
//     que producir la misma forma normalizada, o el contador `count` no
//     incrementa y la tabla se llena de quasi-duplicados.
//   - matchServices() rankea por % de tokens encontrados (no fuzzy real
//     — para eso necesitaríamos pg_trgm). Suficiente para MVP.

import { prisma } from "./prisma";

/**
 * Normaliza una query:
 *   "Reparación  de Lavadoras!" → "reparacion de lavadoras"
 *
 * Pasos: lowercase → quita diacríticos (combining marks U+0300..U+036F)
 * → quita signos no alfanuméricos → colapsa espacios → trim.
 */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchMatch = {
  type: "service" | "category";
  slug: string;
  name: string;
  categoryName?: string;
  score: number;
};

// Mide qué porción de los tokens de la query aparecen en el texto.
function tokenScore(haystack: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) hits++;
  }
  return hits / tokens.length;
}

/**
 * Busca services + categories activas que matcheen la query.
 * Filtra ruido descartando tokens de 1 char y queries vacías.
 *
 * Performance: dos findMany con OR de contains. Para >1k services migrar
 * a full-text search (tsvector + GIN) o pg_trgm.
 */
export async function matchServices(query: string, limit = 5): Promise<SearchMatch[]> {
  const normalized = normalizeQuery(query);
  if (normalized.length < 2) return [];
  const tokens = normalized.split(" ").filter((t) => t.length >= 2);
  if (!tokens.length) return [];

  const nameFilters = tokens.map((t) => ({ name: { contains: t, mode: "insensitive" as const } }));
  const slugFilters = tokens.map((t) => ({ slug: { contains: t, mode: "insensitive" as const } }));

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where: { active: true, OR: [...nameFilters, ...slugFilters] },
      select: {
        slug: true,
        name: true,
        category: { select: { name: true } },
      },
      take: 30,
    }),
    prisma.category.findMany({
      where: { active: true, OR: [...nameFilters, ...slugFilters] },
      select: { slug: true, name: true },
      take: 10,
    }),
  ]);

  const matches: SearchMatch[] = [];

  for (const sv of services) {
    const haystack = normalizeQuery(`${sv.name} ${sv.category.name}`);
    matches.push({
      type: "service",
      slug: sv.slug,
      name: sv.name,
      categoryName: sv.category.name,
      score: tokenScore(haystack, tokens),
    });
  }

  // Categorías rankean por debajo de services (factor 0.8) — mandar al
  // usuario a una categoría sin servicio específico convierte peor.
  for (const cat of categories) {
    const haystack = normalizeQuery(cat.name);
    matches.push({
      type: "category",
      slug: cat.slug,
      name: cat.name,
      score: tokenScore(haystack, tokens) * 0.8,
    });
  }

  return matches
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
