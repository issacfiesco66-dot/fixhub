// WhatsApp Cloud API (Meta) — envío de notificaciones al cliente, best-effort.
//
// CÓMO FUNCIONA (resumen):
//   - Meta NO permite texto libre a quien no te escribió en las últimas 24h.
//     Por eso los avisos proactivos (lead nuevo, "en camino") se mandan con
//     PLANTILLAS pre-aprobadas por Meta. Aquí solo disparamos esas plantillas
//     con sus variables.
//   - Se cobra por "conversación" de 24h; Meta regala 1,000 de servicio/mes.
//
// SETUP (lo hace el dueño del negocio, una sola vez):
//   1. Crear cuenta en Meta Business + app en https://developers.facebook.com
//   2. Agregar el producto "WhatsApp" y registrar el número de negocio.
//   3. Crear las plantillas (ver nombres en WA_TEMPLATES) y esperar aprobación.
//   4. Generar un token PERMANENTE (System User) y copiar el Phone Number ID.
//   5. Setear estas env vars en Vercel (SOLO server-side, NUNCA NEXT_PUBLIC_*):
//        WHATSAPP_PHONE_NUMBER_ID   → ID del número (no es el número en sí)
//        WHATSAPP_ACCESS_TOKEN      → token permanente del System User
//        WHATSAPP_TEMPLATE_LANG     → (opcional) idioma de plantillas, def "es_MX"
//        WHATSAPP_TEMPLATE_TRACKING → (opcional) nombre plantilla seguimiento
//        WHATSAPP_TEMPLATE_ON_THE_WAY → (opcional) nombre plantilla "en camino"
//
// Si faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN, TODO hace no-op:
// no rompe el build, no rompe local, y los correos siguen funcionando igual.

const GRAPH_VERSION = "v21.0";

function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return {
    phoneNumberId,
    accessToken,
    lang: process.env.WHATSAPP_TEMPLATE_LANG ?? "es_MX",
  };
}

// Nombres de las plantillas. Deben coincidir EXACTO con lo que registres en Meta.
// Se pueden sobreescribir por env var sin tocar código.
export const WA_TEMPLATES = {
  tracking: process.env.WHATSAPP_TEMPLATE_TRACKING ?? "fixhub_seguimiento",
  onTheWay: process.env.WHATSAPP_TEMPLATE_ON_THE_WAY ?? "fixhub_en_camino",
};

// Normaliza a formato internacional sin "+", asumiendo México (52) si vienen
// 10 dígitos. Devuelve null si no parece un número válido.
export function normalizePhoneMx(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return "52" + digits; // celular MX a 10 dígitos
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length === 13 && digits.startsWith("521")) return "52" + digits.slice(3); // formato viejo con "1"
  if (digits.length >= 11 && digits.length <= 15) return digits; // ya trae lada de otro país
  return null;
}

async function sendTemplate(opts: {
  to: string;
  template: string;
  bodyParams: string[];
}): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return; // no-op si WhatsApp no está configurado

  const to = normalizePhoneMx(opts.to);
  if (!to) {
    console.warn("[whatsapp] teléfono no normalizable, se omite:", opts.to);
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: opts.template,
      language: { code: cfg.lang },
      components: opts.bodyParams.length
        ? [
            {
              type: "body",
              parameters: opts.bodyParams.map((text) => ({ type: "text", text })),
            },
          ]
        : [],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[whatsapp] envío falló (${res.status}) plantilla=${opts.template}:`, detail);
  }
}

// Aviso inicial al cliente con su link de seguimiento (al crear la solicitud).
// Plantilla sugerida (3 variables):
//   "Hola {{1}} 👋 Recibimos tu solicitud de *{{2}}* en FixHub. Un técnico
//    verificado te contactará en minutos. Sigue tu servicio en vivo aquí: {{3}}"
export async function sendClientTrackingWhatsApp(opts: {
  to: string;
  clientName: string;
  serviceName: string;
  trackUrl: string;
}): Promise<void> {
  try {
    await sendTemplate({
      to: opts.to,
      template: WA_TEMPLATES.tracking,
      bodyParams: [opts.clientName, opts.serviceName, opts.trackUrl],
    });
  } catch (e) {
    console.error("[whatsapp] tracking error:", e instanceof Error ? e.message : e);
  }
}

// Aviso "el técnico va en camino" (cuando el técnico marca ON_THE_WAY).
// Plantilla sugerida (4 variables):
//   "Hola {{1}} 🚗 {{2}} ya va en camino para tu servicio de *{{3}}*.
//    Sigue su llegada en vivo aquí: {{4}}"
export async function sendClientOnTheWayWhatsApp(opts: {
  to: string;
  clientName: string;
  technicianName: string;
  serviceName: string;
  trackUrl: string;
}): Promise<void> {
  try {
    await sendTemplate({
      to: opts.to,
      template: WA_TEMPLATES.onTheWay,
      bodyParams: [opts.clientName, opts.technicianName, opts.serviceName, opts.trackUrl],
    });
  } catch (e) {
    console.error("[whatsapp] onTheWay error:", e instanceof Error ? e.message : e);
  }
}
