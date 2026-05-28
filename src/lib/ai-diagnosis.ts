// Asistente de diagnóstico de reparación via OpenAI.
// Usado por /api/leads/[id]/diagnosis — el técnico que compró un lead pide
// posibles soluciones al problema reportado por el cliente.
//
// Mismo patrón que ai-content.ts: cliente lazy-init (no romper `next build`
// sin OPENAI_API_KEY), gpt-4o-mini, salida JSON estricta y validada.

import OpenAI from "openai";

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY no configurado. Añádelo en las env vars del hosting.");
    }
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export type DiagnosisCause = {
  cause: string; // causa probable
  likelihood: "alta" | "media" | "baja"; // probabilidad relativa
  check: string; // cómo verificar/confirmar esta causa
  solution: string; // cómo resolverla
  part: string | null; // repuesto típico (null si no aplica)
};

export type RepairDiagnosis = {
  summary: string; // resumen del diagnóstico en 1-2 frases
  causes: DiagnosisCause[]; // ordenadas de más a menos probable
  tools: string[]; // herramientas necesarias
  estimatedTime: string; // tiempo estimado de reparación
  safety: string[]; // advertencias de seguridad
};

export type DiagnosisInput = {
  serviceName: string;
  brandName: string | null;
  problem: string; // la falla reportada por el cliente
};

export async function generateRepairDiagnosis(
  input: DiagnosisInput
): Promise<RepairDiagnosis> {
  const brandLine = input.brandName ? `Marca/modelo: ${input.brandName}` : "Marca: no especificada";

  const userPrompt = `Eres un técnico reparador senior. Un cliente reportó esta falla y necesitas darle al técnico de campo el MAYOR número de causas probables y soluciones para que repare a la primera.

Servicio: ${input.serviceName}
${brandLine}
Problema reportado: "${input.problem}"

Devuelve JSON estricto con esta estructura exacta:
{
  "summary": "Resumen del diagnóstico en 1-2 frases.",
  "causes": [
    {
      "cause": "Causa probable concreta",
      "likelihood": "alta | media | baja",
      "check": "Cómo verificar/confirmar esta causa en sitio (paso concreto)",
      "solution": "Cómo resolverla (acción concreta)",
      "part": "Repuesto típico necesario, o null si no aplica"
    }
  ],
  "tools": ["herramienta 1", "herramienta 2"],
  "estimatedTime": "ej. 30-60 min",
  "safety": ["advertencia de seguridad concreta (ej. desconectar de la corriente antes de abrir)"]
}

Reglas:
- Da entre 4 y 8 causas, ordenadas de MÁS a MENOS probable, específicas al servicio${input.brandName ? ` y marca ${input.brandName}` : ""}.
- Sé concreto y práctico (códigos de error, componentes específicos, valores típicos). Nada de relleno.
- En "safety" incluye SIEMPRE las precauciones reales del trabajo (eléctrico, gas, agua, presión) — la seguridad del técnico es prioridad.
- Español de México, lenguaje de taller. Solo el JSON, sin texto extra.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    temperature: 0.5, // más determinista que el SEO — queremos precisión técnica
    messages: [
      {
        role: "system",
        content:
          "Eres un técnico reparador experto en servicios del hogar en México (línea blanca, plomería, electricidad, climatización, etc.). Diagnosticas con precisión y priorizas la seguridad. Siempre devuelves JSON válido.",
      },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI devolvió respuesta vacía");

  let parsed: RepairDiagnosis;
  try {
    parsed = JSON.parse(raw) as RepairDiagnosis;
  } catch {
    throw new Error(`Respuesta no es JSON válido: ${raw.slice(0, 200)}`);
  }

  // Validación mínima de calidad
  if (!parsed.summary || typeof parsed.summary !== "string") {
    throw new Error("Diagnóstico inválido: falta summary");
  }
  if (!Array.isArray(parsed.causes) || parsed.causes.length === 0) {
    throw new Error("Diagnóstico inválido: sin causas");
  }

  // Normalizar/sanear: garantizar tipos y defaults
  return {
    summary: parsed.summary.trim(),
    causes: parsed.causes.slice(0, 8).map((c) => ({
      cause: String(c.cause ?? "").trim(),
      likelihood: c.likelihood === "alta" || c.likelihood === "baja" ? c.likelihood : "media",
      check: String(c.check ?? "").trim(),
      solution: String(c.solution ?? "").trim(),
      part: c.part ? String(c.part).trim() : null,
    })),
    tools: Array.isArray(parsed.tools) ? parsed.tools.map((t) => String(t).trim()).filter(Boolean) : [],
    estimatedTime: parsed.estimatedTime ? String(parsed.estimatedTime).trim() : "No estimado",
    safety: Array.isArray(parsed.safety) ? parsed.safety.map((s) => String(s).trim()).filter(Boolean) : [],
  };
}
