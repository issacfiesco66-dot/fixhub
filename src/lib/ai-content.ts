// Generador de contenido Geo-SEO via OpenAI.
// Usado por:
//   - scripts/generate-seo-content.ts (batch CLI)
//   - /api/admin/seo/generate (on-demand desde el panel admin)
//
// Diseño: una sola función `generateServiceContent` que recibe una tupla
// (service × brand? × city) y devuelve { h1, metaDescription, body } ya
// validados. El consumidor decide si lo guarda en DB (upsert por tupla).

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export type GeneratedContent = {
  h1: string;
  metaDescription: string;
  body: string;
};

export type GenerationInput = {
  serviceName: string;
  brandName: string | null;
  cityName: string;
  stateName: string;
  zones: string[];
};

// Genera contenido único optimizado para SEO local.
// Lanza si OPENAI_API_KEY no está configurado o si la respuesta es inválida.
export async function generateServiceContent(
  input: GenerationInput
): Promise<GeneratedContent> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurado. Añádelo a .env");
  }

  const zonesStr = input.zones.slice(0, 6).join(", ") || "toda la ciudad";
  const brandLine = input.brandName
    ? `Marca: ${input.brandName}`
    : "Marca: (servicio sin marca específica)";

  const userPrompt = `Genera contenido SEO local único para una landing page de servicios técnicos.

Servicio: ${input.serviceName}
${brandLine}
Ubicación: ${input.cityName}, ${input.stateName}
Zonas prioritarias: ${zonesStr}

Devuelve JSON estricto con esta estructura:
{
  "h1": "Título H1 optimizado (60-80 caracteres), incluye servicio + marca + ciudad, variando la fórmula entre tuplas para no repetir patrón",
  "metaDescription": "Meta description persuasiva (140-160 caracteres) — incluye servicio, ciudad, USP de garantía/rapidez",
  "body": "Texto indexable de 130-160 palabras, único, sin saludos ni despedidas. Debe mencionar: (1) fallas comunes específicas${input.brandName ? ` de ${input.brandName}` : ""} (ej. códigos de error, ruidos en transmisión, problemas eléctricos); (2) la importancia de reparar a domicilio en ${input.cityName} usando refacciones originales y mencionar al menos 2 zonas de ${zonesStr}; (3) CTA urgente al final. Tono profesional, cercano, sin tecnicismos innecesarios. NO repitas frases textuales con otras ciudades."
}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    temperature: 0.75,
    messages: [
      {
        role: "system",
        content:
          "Eres un redactor SEO experto en servicios técnicos del hogar en México. Generas contenido único, persuasivo y optimizado para búsquedas locales (Google + AI Overviews). Siempre devuelves JSON válido.",
      },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI devolvió respuesta vacía");

  let parsed: GeneratedContent;
  try {
    parsed = JSON.parse(raw) as GeneratedContent;
  } catch {
    throw new Error(`Respuesta no es JSON válido: ${raw.slice(0, 200)}`);
  }

  // Validación mínima de calidad — si falla, mejor abortar que guardar basura
  if (!parsed.h1 || parsed.h1.length < 10) {
    throw new Error(`H1 inválido: "${parsed.h1}"`);
  }
  if (!parsed.metaDescription || parsed.metaDescription.length < 50) {
    throw new Error(`metaDescription inválido (muy corto)`);
  }
  if (!parsed.body || parsed.body.length < 400) {
    throw new Error(`body inválido (muy corto: ${parsed.body?.length ?? 0} chars)`);
  }

  return {
    h1: parsed.h1.trim(),
    metaDescription: parsed.metaDescription.trim(),
    body: parsed.body.trim(),
  };
}

// Helper: dada una tupla de prisma + records relacionados, hace generate
// + upsert atómico al ServiceContent. Devuelve el row guardado.
type PrismaLike = {
  serviceContent: {
    upsert: (args: {
      where: { serviceId_brandId_cityId: { serviceId: string; brandId: string | null; cityId: string } };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => Promise<unknown>;
  };
};

export async function generateAndSave(
  prisma: PrismaLike,
  ids: { serviceId: string; brandId: string | null; cityId: string },
  input: GenerationInput
) {
  const content = await generateServiceContent(input);

  const data = {
    h1: content.h1,
    metaDescription: content.metaDescription,
    body: content.body,
    source: "AI_GPT" as const,
    reviewed: false,
  };

  return prisma.serviceContent.upsert({
    where: { serviceId_brandId_cityId: ids },
    update: data,
    create: { ...ids, ...data },
  });
}
