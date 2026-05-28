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

// ─────────────────────────────────────────────────────────────────────
// ASISTENTE LIBRE — el técnico consulta cualquier equipo para reparación,
// instalación o mantenimiento (no atado a un lead comprado).
// ─────────────────────────────────────────────────────────────────────

export type WorkType = "reparacion" | "instalacion" | "mantenimiento";

export type AssistItem = {
  title: string; // causa / paso / tarea
  detail: string; // cómo se hace / verifica / por qué
  tag: string | null; // etiqueta contextual: probabilidad, frecuencia, material…
};

export type TechAssist = {
  workType: WorkType;
  summary: string;
  items: AssistItem[];
  materials: string[]; // materiales, repuestos o herramientas
  estimatedTime: string;
  safety: string[];
};

export type TechAssistInput = {
  workType: WorkType;
  equipment: string; // equipo + marca/modelo (texto libre)
  description: string; // síntoma o contexto del trabajo
};

const WORK_TYPE_INSTRUCTIONS: Record<WorkType, { label: string; itemsGuide: string }> = {
  reparacion: {
    label: "REPARACIÓN",
    itemsGuide:
      'cada item es una CAUSA PROBABLE de la falla, ordenadas de más a menos probable. "title"=causa concreta, "detail"=cómo verificarla + cómo resolverla, "tag"="Probable" | "Posible" | "Menos común".',
  },
  instalacion: {
    label: "INSTALACIÓN",
    itemsGuide:
      'cada item es un PASO de instalación en ORDEN secuencial. "title"=el paso, "detail"=cómo ejecutarlo bien (medidas, conexiones, normas), "tag"=null o un tip clave (ej. "Crítico", "Nivelar").',
  },
  mantenimiento: {
    label: "MANTENIMIENTO PREVENTIVO",
    itemsGuide:
      'cada item es una TAREA de mantenimiento. "title"=la tarea, "detail"=cómo hacerla y por qué importa, "tag"=frecuencia recomendada (ej. "Cada 3 meses", "Anual").',
  },
};

export async function generateTechAssist(input: TechAssistInput): Promise<TechAssist> {
  const wt = WORK_TYPE_INSTRUCTIONS[input.workType];

  const userPrompt = `Un técnico de campo necesita ayuda para un trabajo de ${wt.label}.

Equipo: ${input.equipment}
Detalle: "${input.description}"

Devuelve JSON estricto:
{
  "summary": "Resumen en 1-2 frases de cómo encarar el trabajo.",
  "items": [
    { "title": "...", "detail": "...", "tag": "etiqueta o null" }
  ],
  "materials": ["material/repuesto/herramienta 1", "..."],
  "estimatedTime": "ej. 1-2 horas",
  "safety": ["advertencia de seguridad concreta"]
}

Para este trabajo (${wt.label}): ${wt.itemsGuide}

Reglas:
- Da entre 4 y 8 items, concretos y prácticos, específicos al equipo indicado.
- "materials" lista lo que el técnico debe llevar.
- "safety" SIEMPRE con las precauciones reales (eléctrico, gas, agua, altura, presión).
- Español de México, lenguaje de taller. Solo el JSON, sin texto extra.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "Eres un técnico multi-oficio experto en servicios del hogar en México (línea blanca, plomería, electricidad, climatización, cerrajería, etc.). Das instrucciones precisas y priorizas la seguridad. Siempre devuelves JSON válido.",
      },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI devolvió respuesta vacía");

  let parsed: TechAssist;
  try {
    parsed = JSON.parse(raw) as TechAssist;
  } catch {
    throw new Error(`Respuesta no es JSON válido: ${raw.slice(0, 200)}`);
  }

  if (!parsed.summary || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Respuesta de asistente inválida");
  }

  return {
    workType: input.workType,
    summary: String(parsed.summary).trim(),
    items: parsed.items.slice(0, 8).map((it) => ({
      title: String(it.title ?? "").trim(),
      detail: String(it.detail ?? "").trim(),
      tag: it.tag ? String(it.tag).trim() : null,
    })),
    materials: Array.isArray(parsed.materials)
      ? parsed.materials.map((m) => String(m).trim()).filter(Boolean)
      : [],
    estimatedTime: parsed.estimatedTime ? String(parsed.estimatedTime).trim() : "No estimado",
    safety: Array.isArray(parsed.safety) ? parsed.safety.map((s) => String(s).trim()).filter(Boolean) : [],
  };
}
