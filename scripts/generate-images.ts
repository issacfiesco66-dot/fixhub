/**
 * Generador de imágenes Geo-SEO via OpenAI gpt-image-1.
 *
 * Genera y persiste en public/images/ las imágenes del hero,
 * categorías y servicios. Idempotente: skip si ya existen
 * (usa --force para regenerar).
 *
 * Uso:
 *   pnpm tsx scripts/generate-images.ts
 *   pnpm tsx scripts/generate-images.ts --force
 *   pnpm tsx scripts/generate-images.ts --only=hero,cat-linea-blanca
 *
 * Costo aprox: gpt-image-1 medium = ~$0.042/imagen → 9 imágenes ≈ $0.40 USD.
 */

import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUT_DIR = path.resolve("public/images");

// Estilo común aplicado a todas las imágenes para consistencia visual.
const STYLE = "Premium SaaS marketing style. Soft indigo and emerald color accents. Clean composition. No text, no logos, no watermarks.";

type Asset = {
  slug: string;
  size: "1024x1024" | "1536x1024" | "1024x1536";
  prompt: string;
};

const ASSETS: Asset[] = [
  // ── HERO ─────────────────────────────────────────────────────
  {
    slug: "hero",
    size: "1536x1024",
    prompt: `Friendly professional Mexican male technician in clean dark blue uniform, holding a tablet, standing confidently in a modern bright kitchen. A premium washing machine and refrigerator are visible in the background. Soft natural lighting through a window. Wide cinematic landscape composition. Slight indigo glow accent. Photorealistic editorial photography for a service marketplace landing page. ${STYLE}`,
  },

  // ── CATEGORÍAS (5 nuevas) ───────────────────────────────────
  {
    slug: "cat-emergencia",
    size: "1024x1024",
    prompt: `Isometric 3D illustration showing emergency home service icons: a stylized red alert badge, a key, a wrench and a lightning bolt, arranged elegantly. Subtle red and indigo gradient background suggesting urgency. Soft shadows. Square centered composition. ${STYLE}`,
  },
  {
    slug: "cat-reparacion-soporte",
    size: "1024x1024",
    prompt: `Isometric 3D illustration of a modern white washing machine, a stainless steel refrigerator and a sleek minisplit AC unit arranged together with subtle indigo glow. Clean minimal background with soft shadows. Square centered composition. ${STYLE}`,
  },
  {
    slug: "cat-mantenimiento-hogar",
    size: "1024x1024",
    prompt: `Isometric 3D illustration of a modern paint brush, a fumigation spray can and cleaning gloves arranged on a clean surface. A small house silhouette in the background. Subtle indigo gradient. Soft shadows. Square centered composition. ${STYLE}`,
  },
  {
    slug: "cat-automotriz-logistica",
    size: "1024x1024",
    prompt: `Isometric 3D illustration of a modern compact tow truck and a small moving van side by side on a clean road segment. Subtle indigo gradient background. Soft shadows. Square centered composition. ${STYLE}`,
  },
  {
    slug: "cat-especializados-prevision",
    size: "1024x1024",
    prompt: `Isometric 3D illustration of a stylized heart icon, a small white candle and a paw print arranged together with soft warm lighting. Calm indigo and warm white gradient background. Respectful, elegant tone. Square centered composition. ${STYLE}`,
  },

  // ── SERVICIOS EXISTENTES (línea blanca + plomería/eléctrica) ──
  {
    slug: "svc-reparacion-lavadoras",
    size: "1024x1024",
    prompt: `Professional photograph of a technician's hands carefully working on the back panel of a modern white front-load washing machine, with a small toolkit visible to the side. Bright laundry room with clean tiles. Editorial service photography style. ${STYLE}`,
  },
  {
    slug: "svc-reparacion-refrigeradores",
    size: "1024x1024",
    prompt: `Professional photograph of a technician inspecting the interior of a modern stainless steel two-door refrigerator with the doors open. Bright modern kitchen background. Editorial service photography style. ${STYLE}`,
  },
  {
    slug: "svc-reparacion-secadoras",
    size: "1024x1024",
    prompt: `Professional photograph of a technician opening the front-load door of a modern dryer, focused on inspecting the lint filter. Clean modern laundry room. Editorial service photography style. ${STYLE}`,
  },
  {
    slug: "svc-fuga-de-agua",
    size: "1024x1024",
    prompt: `Professional photograph of a plumber repairing a chrome pipe under a modern white sink with a wrench in hand. Clean tools visible. Bright modern bathroom. Editorial service photography style. ${STYLE}`,
  },
  {
    slug: "svc-instalacion-electrica",
    size: "1024x1024",
    prompt: `Professional photograph of an electrician with safety gloves working on a modern white electrical breaker panel mounted on a clean wall. Tools visible. Editorial service photography style. ${STYLE}`,
  },

  // ── SERVICIOS NUEVOS (12) ───────────────────────────────────
  {
    slug: "svc-cerrajeria",
    size: "1024x1024",
    prompt: `Professional service photo: a friendly uniformed technician at a modern front door of a clean residential home, holding a small set of new shiny brass keys in one hand. He has a small toolbox beside him on the porch. Daylight, welcoming and trustworthy mood. Editorial service photography style. ${STYLE}`,
  },
  {
    slug: "svc-climatizacion",
    size: "1024x1024",
    prompt: `Professional photograph of a technician on a small ladder installing a sleek white minisplit air conditioning unit on a clean modern wall. Bright sunlit living room. Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-fumigacion-control-plagas",
    size: "1024x1024",
    prompt: `Professional photograph of a pest control technician in clean white protective gear and mask, holding a professional spray applicator in a modern kitchen. Clean and reassuring composition (no insects visible). Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-limpieza-especializada",
    size: "1024x1024",
    prompt: `Professional photograph of a cleaning specialist with gloves polishing a modern living room sofa with a steam cleaner. Bright spotless interior. Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-impermeabilizacion",
    size: "1024x1024",
    prompt: `Professional photograph of a worker applying a roller with white waterproofing coating onto a modern flat rooftop. Blue sky in the background. Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-pintura-tablaroca",
    size: "1024x1024",
    prompt: `Professional photograph of a painter rolling fresh light gray paint onto a clean smooth wall with crisp masking tape edges visible. Bright modern interior. Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-mecanica-domicilio",
    size: "1024x1024",
    prompt: `Professional photograph of a mechanic with clean uniform using a diagnostic scanner connected to the dashboard of a modern car parked in a residential driveway. Open hood visible in background. Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-gruas-auxilio-vial",
    size: "1024x1024",
    prompt: `Professional photograph of a modern compact tow truck with subtle amber warning lights lifting the front of a stalled car on a quiet road. Daytime, clean composition. Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-fletes-mudanzas",
    size: "1024x1024",
    prompt: `Professional photograph of two movers in clean uniforms carrying a wrapped sofa toward a parked small moving van in a residential street. Daytime, friendly mood. Editorial photography style. ${STYLE}`,
  },
  {
    slug: "svc-servicios-funerarios",
    size: "1024x1024",
    prompt: `Quiet elegant indoor scene with soft warm light: a small white candle on a wooden surface beside a single white flower. Calm, respectful, dignified tone. No people, no symbols of grief. ${STYLE}`,
  },
  {
    slug: "svc-cuidado-mascotas",
    size: "1024x1024",
    prompt: `Professional photograph of a friendly veterinarian in white coat gently examining a small healthy dog on a clean exam table at a modern bright veterinary clinic. Warm reassuring scene. Editorial photography style. ${STYLE}`,
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY no configurado en .env");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const onlyList = onlyArg ? new Set(onlyArg.split("=")[1].split(",")) : null;

  await fs.mkdir(OUT_DIR, { recursive: true });

  const todo = onlyList ? ASSETS.filter((a) => onlyList.has(a.slug)) : ASSETS;
  console.log(`🎨 Generando ${todo.length} imágenes (gpt-image-1 medium quality)\n`);

  let ok = 0;
  let skipped = 0;
  let err = 0;

  for (let i = 0; i < todo.length; i++) {
    const a = todo[i];
    const outPath = path.join(OUT_DIR, `${a.slug}.png`);
    const tag = `[${i + 1}/${todo.length}] ${a.slug}`;

    // Idempotencia
    if (!force) {
      try {
        await fs.access(outPath);
        console.log(`⏩ ${tag} — ya existe (usa --force para regenerar)`);
        skipped++;
        continue;
      } catch {
        /* no existe, continúa */
      }
    }

    process.stdout.write(`🎨 ${tag} (${a.size})... `);

    try {
      const result = await client.images.generate({
        model: "gpt-image-1",
        prompt: a.prompt,
        size: a.size,
        quality: "medium",
        n: 1,
      });

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error("respuesta sin b64_json");

      await fs.writeFile(outPath, Buffer.from(b64, "base64"));
      const stat = await fs.stat(outPath);
      console.log(`✅ ${Math.round(stat.size / 1024)} KB`);
      ok++;

      // Pausa preventiva entre llamadas
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      err++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ ${msg}`);
    }
  }

  console.log(`\n🎉 ${ok} generadas, ${skipped} skip, ${err} errores.`);
  if (err > 0) console.log("   Re-corre el script — saltará las que ya se generaron.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
