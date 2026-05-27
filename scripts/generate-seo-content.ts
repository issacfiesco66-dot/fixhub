/**
 * Generador masivo de contenido Geo-SEO via OpenAI.
 *
 * Itera TODAS las tuplas (service × brand? × city) del catálogo, genera
 * contenido único con gpt-4o-mini y lo inserta en ServiceContent.
 *
 * - Idempotente: salta tuplas que ya tienen contenido (no gasta tokens 2 veces).
 * - Servicios sin marca (plomería, electricidad) → tuplas (service × null × city).
 * - Pausa 500ms entre llamadas para no pegarle al rate limit.
 *
 * Uso:
 *   pnpm tsx scripts/generate-seo-content.ts
 *   pnpm tsx scripts/generate-seo-content.ts --force   (regenera incluso si existe)
 *   pnpm tsx scripts/generate-seo-content.ts --limit=10  (solo las primeras 10 faltantes)
 */

import { PrismaClient } from "@prisma/client";
import { generateServiceContent } from "../src/lib/ai-content";
import { upsertServiceContent } from "../src/lib/service-content-store";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = (() => {
  const a = args.find((a) => a.startsWith("--limit="));
  return a ? parseInt(a.split("=")[1], 10) : Infinity;
})();

async function main() {
  console.log("🚀 FixHub Geo-SEO content generator");
  console.log(`   modo: ${FORCE ? "FORCE (regenera todo)" : "incremental (solo faltantes)"}`);
  console.log(`   límite: ${LIMIT === Infinity ? "sin límite" : LIMIT}\n`);

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY no configurado en .env");
    process.exit(1);
  }

  // Cargar catálogo
  const [services, cities, existing] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      include: { brands: { include: { brand: true } }, category: true },
    }),
    prisma.city.findMany({
      where: { active: true },
      include: { state: true, zones: true },
    }),
    prisma.serviceContent.findMany({
      select: { serviceId: true, brandId: true, cityId: true },
    }),
  ]);

  const existingSet = new Set(
    existing.map((e) => `${e.serviceId}:${e.brandId ?? "null"}:${e.cityId}`)
  );

  // Construir tuplas
  type Tuple = {
    service: (typeof services)[number];
    brand: (typeof services)[number]["brands"][number]["brand"] | null;
    city: (typeof cities)[number];
  };

  const allTuples: Tuple[] = [];
  for (const sv of services) {
    const brandList = sv.requiresBrand ? sv.brands.map((sb) => sb.brand) : [null];
    for (const b of brandList) {
      for (const ct of cities) {
        allTuples.push({ service: sv, brand: b, city: ct });
      }
    }
  }

  const missing = FORCE
    ? allTuples
    : allTuples.filter(
        (t) => !existingSet.has(`${t.service.id}:${t.brand?.id ?? "null"}:${t.city.id}`)
      );

  const todo = missing.slice(0, LIMIT);

  console.log(`📊 Catálogo: ${allTuples.length} tuplas totales`);
  console.log(`   Ya con contenido: ${existing.length}`);
  console.log(`   Faltantes: ${missing.length}`);
  console.log(`   A generar ahora: ${todo.length}\n`);

  if (todo.length === 0) {
    console.log("✅ Nada que hacer.");
    return;
  }

  let ok = 0;
  let err = 0;
  let i = 0;

  for (const t of todo) {
    i++;
    const tag = `[${i}/${todo.length}] ${t.service.name}${t.brand ? ` ${t.brand.name}` : ""} @ ${t.city.name}`;
    process.stdout.write(`🧠 ${tag} ... `);

    try {
      const content = await generateServiceContent({
        serviceName: t.service.name,
        brandName: t.brand?.name ?? null,
        cityName: t.city.name,
        stateName: t.city.state.name,
        zones: t.city.zones.map((z) => z.name),
      });

      await upsertServiceContent(
        prisma,
        { serviceId: t.service.id, brandId: t.brand?.id ?? null, cityId: t.city.id },
        {
          h1: content.h1,
          metaDescription: content.metaDescription,
          body: content.body,
          source: "AI_GPT",
          reviewed: false,
        }
      );

      ok++;
      console.log(`✅ ${content.body.length} chars`);

      // Pausa para respetar rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      err++;
      console.log(`❌ ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n🎉 Finalizado: ${ok} OK, ${err} errores.`);
  if (err > 0) console.log("   Tip: vuelve a correr — saltará las que sí se generaron.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
