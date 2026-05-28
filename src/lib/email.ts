// Email sender via Resend, con lazy-init para no romper build sin la key.
//
// Setup:
//   1. Crea cuenta en https://resend.com (free 100 emails/día)
//   2. Settings → API Keys → "Create API Key"
//   3. Setea RESEND_API_KEY en Vercel env vars
//   4. (Opcional) Verifica tu dominio en Resend para enviar desde @tudominio
//      Mientras tanto: from='onboarding@resend.dev' funciona pero solo
//      manda al email registrado en Resend.

import { Resend } from "resend";

let cached: Resend | null = null;
function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY no configurado. Crea cuenta en https://resend.com y configura la env var."
    );
  }
  cached = new Resend(key);
  return cached;
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? "FixHub <onboarding@resend.dev>";

// Correo del admin que recibe las notificaciones internas (lead nuevo, técnico
// nuevo). Configurable por env var. Si no está, las notificaciones se omiten.
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "";

function adminShell(title: string, rows: { label: string; value: string }[], cta?: { label: string; url: string }): string {
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:130px;vertical-align:top;">${r.label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:500;">${r.value || "—"}</td></tr>`
    )
    .join("");
  const ctaHtml = cta
    ? `<div style="text-align:center;margin:24px 0 4px;"><a href="${cta.url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-weight:600;padding:11px 26px;border-radius:12px;text-decoration:none;">${cta.label}</a></div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,system-ui,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">
      <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#6366f1,#4338ca);display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:700;">🔧</div>
      <span style="font-size:16px;font-weight:600;color:#0f172a;">FixHub · Admin</span>
    </div>
    <h1 style="font-size:19px;color:#0f172a;margin:0 0 16px;">${title}</h1>
    <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
    ${ctaHtml}
  </div>
</body></html>`.trim();
}

export async function sendAdminLeadNotification(args: {
  service: string;
  brand?: string | null;
  city: string;
  zone?: string | null;
  urgency: string;
  failure: string;
  clientName: string;
  clientPhone: string;
}) {
  if (!ADMIN_EMAIL) return; // sin destinatario configurado, no-op
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fix-hub.company";
  const urgencyLabel = args.urgency === "EMERGENCY" ? "🚨 Emergencia" : args.urgency === "URGENT" ? "⚡ Urgente" : "Normal";
  const html = adminShell(
    "Nueva solicitud de servicio",
    [
      { label: "Servicio", value: `${args.service}${args.brand ? ` · ${args.brand}` : ""}` },
      { label: "Ubicación", value: `${args.city}${args.zone ? `, ${args.zone}` : ""}` },
      { label: "Urgencia", value: urgencyLabel },
      { label: "Cliente", value: args.clientName },
      { label: "Teléfono", value: args.clientPhone },
      { label: "Problema", value: args.failure },
    ],
    { label: "Ver leads en el panel", url: `${baseUrl}/admin/leads` }
  );
  const text = `Nueva solicitud: ${args.service}${args.brand ? ` (${args.brand})` : ""} en ${args.city}. Cliente: ${args.clientName} — ${args.clientPhone}. Problema: ${args.failure}`;
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `🛎️ Nuevo lead: ${args.service} en ${args.city}`,
    html,
    text,
  });
}

export async function sendAdminTechnicianNotification(args: {
  displayName: string;
  email: string;
  phone: string;
  cities: string[];
  services: string[];
}) {
  if (!ADMIN_EMAIL) return;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fix-hub.company";
  const html = adminShell(
    "Nuevo técnico registrado (pendiente de verificar)",
    [
      { label: "Nombre", value: args.displayName },
      { label: "Email", value: args.email },
      { label: "Teléfono", value: args.phone },
      { label: "Ciudades", value: args.cities.join(", ") },
      { label: "Servicios", value: args.services.join(", ") },
    ],
    { label: "Verificar técnico", url: `${baseUrl}/admin/technicians` }
  );
  const text = `Nuevo técnico: ${args.displayName} (${args.email}, ${args.phone}). Ciudades: ${args.cities.join(", ")}. Servicios: ${args.services.join(", ")}. Verifícalo en /admin/technicians`;
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `👷 Nuevo técnico: ${args.displayName}`,
    html,
    text,
  });
}

export async function sendPasswordResetEmail(args: {
  to: string;
  resetUrl: string;
  userName?: string | null;
}) {
  const { to, resetUrl, userName } = args;
  const greeting = userName ? `Hola ${userName.split(" ")[0]}` : "Hola";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,system-ui,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:32px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#4338ca);display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:700;">🔧</div>
      <span style="font-size:18px;font-weight:600;color:#0f172a;">FixHub</span>
    </div>

    <h1 style="font-size:22px;color:#0f172a;margin:0 0 16px;">${greeting},</h1>
    <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
      Recibimos una solicitud para restablecer tu contraseña en FixHub.
      Haz click en el botón para crear una nueva (el enlace expira en 1 hora):
    </p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;box-shadow:0 4px 12px rgba(99,102,241,0.3);">
        Restablecer contraseña
      </a>
    </div>

    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:24px 0 0;">
      Si no fuiste tú, ignora este correo — tu contraseña actual sigue siendo válida.
      Por seguridad, el enlace solo puede usarse una vez.
    </p>

    <p style="color:#94a3b8;font-size:11px;line-height:1.6;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
      <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
    </p>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">
    © ${new Date().getFullYear()} FixHub · Hecho en México
  </p>
</body>
</html>`.trim();

  const text = `${greeting},

Recibimos una solicitud para restablecer tu contraseña en FixHub.
Abre este enlace para crear una nueva (expira en 1 hora):

${resetUrl}

Si no fuiste tú, ignora este correo — tu contraseña actual sigue siendo válida.

— FixHub`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Restablecer tu contraseña — FixHub",
    html,
    text,
  });
}

export async function sendReviewRequestEmail(args: {
  to: string;
  reviewUrl: string;
  technicianName: string;
  serviceName: string;
  clientName?: string | null;
}) {
  const { to, reviewUrl, technicianName, serviceName, clientName } = args;
  const greeting = clientName ? `Hola ${clientName.split(" ")[0]}` : "Hola";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,system-ui,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:32px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#4338ca);display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:700;">🔧</div>
      <span style="font-size:18px;font-weight:600;color:#0f172a;">FixHub</span>
    </div>

    <h1 style="font-size:22px;color:#0f172a;margin:0 0 16px;">${greeting},</h1>
    <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
      ${technicianName} marcó como completado tu servicio de <strong>${serviceName}</strong>.
      ¿Cómo te fue? Tu opinión nos ayuda a mantener a los mejores técnicos en FixHub.
    </p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${reviewUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;box-shadow:0 4px 12px rgba(99,102,241,0.3);">
        Calificar el servicio
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;line-height:1.6;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      Si el botón no funciona, copia y pega este enlace:<br>
      <a href="${reviewUrl}" style="color:#6366f1;word-break:break-all;">${reviewUrl}</a>
    </p>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">
    © ${new Date().getFullYear()} FixHub · Hecho en México
  </p>
</body>
</html>`.trim();

  const text = `${greeting},

${technicianName} marcó como completado tu servicio de ${serviceName}.
¿Cómo te fue? Califica el servicio aquí:

${reviewUrl}

— FixHub`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `¿Cómo te fue con tu servicio de ${serviceName}? — FixHub`,
    html,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────
// SEGUIMIENTO DEL CLIENTE — emails alrededor del estado del servicio.
// Nota: WhatsApp/SMS automático requeriría un proveedor (Twilio / WhatsApp
// Business API). Mientras tanto, el email cubre el aviso y el técnico puede
// mandar el link por WhatsApp manualmente desde su panel.
// ─────────────────────────────────────────────────────────────────────

function clientShell(args: {
  greeting: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
}): string {
  const { greeting, heading, bodyHtml, cta, footerNote } = args;
  const ctaHtml = cta
    ? `<div style="text-align:center;margin:28px 0;"><a href="${cta.url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;box-shadow:0 4px 12px rgba(99,102,241,0.3);">${cta.label}</a></div>`
    : "";
  const linkFallback = cta
    ? `<p style="color:#94a3b8;font-size:11px;line-height:1.6;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">Si el botón no funciona, copia y pega este enlace:<br><a href="${cta.url}" style="color:#6366f1;word-break:break-all;">${cta.url}</a></p>`
    : "";
  const noteHtml = footerNote
    ? `<p style="color:#64748b;font-size:13px;line-height:1.6;margin:20px 0 0;">${footerNote}</p>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,system-ui,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:32px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#4338ca);display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:700;">🔧</div>
      <span style="font-size:18px;font-weight:600;color:#0f172a;">FixHub</span>
    </div>
    <h1 style="font-size:21px;color:#0f172a;margin:0 0 14px;">${greeting},</h1>
    <h2 style="font-size:16px;color:#0f172a;margin:0 0 12px;font-weight:600;">${heading}</h2>
    <div style="color:#475569;line-height:1.6;font-size:14px;">${bodyHtml}</div>
    ${ctaHtml}
    ${noteHtml}
    ${linkFallback}
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">
    © ${new Date().getFullYear()} FixHub · Hecho en México
  </p>
</body>
</html>`.trim();
}

// Email al cliente al CREAR la solicitud — incluye el link de seguimiento.
export async function sendClientTrackingEmail(args: {
  to: string;
  clientName: string;
  serviceName: string;
  trackUrl: string;
}) {
  const { to, clientName, serviceName, trackUrl } = args;
  const greeting = clientName ? `Hola ${clientName.split(" ")[0]}` : "Hola";
  const html = clientShell({
    greeting,
    heading: "Recibimos tu solicitud ✅",
    bodyHtml: `Estamos avisando a los técnicos verificados de tu zona para tu servicio de <strong>${serviceName}</strong>. En minutos uno confirmará y te contactará.<br><br>Puedes <strong>seguir el estado en vivo</strong> y cancelar cuando quieras desde este enlace privado:`,
    cta: { label: "Seguir mi solicitud", url: trackUrl },
    footerNote: "Guarda este enlace: es tu acceso privado al seguimiento, sin necesidad de crear cuenta.",
  });
  const text = `${greeting},\n\nRecibimos tu solicitud de ${serviceName}. Un técnico verificado te contactará en minutos.\n\nSigue el estado en vivo y cancela cuando quieras aquí:\n${trackUrl}\n\n— FixHub`;
  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Recibimos tu solicitud de ${serviceName} — FixHub`,
    html,
    text,
  });
}

// Email al cliente cuando el técnico marca que VA EN CAMINO.
export async function sendClientOnTheWayEmail(args: {
  to: string;
  clientName: string;
  technicianName: string;
  serviceName: string;
  trackUrl: string;
}) {
  const { to, clientName, technicianName, serviceName, trackUrl } = args;
  const greeting = clientName ? `Hola ${clientName.split(" ")[0]}` : "Hola";
  const html = clientShell({
    greeting,
    heading: "🚗 Tu técnico va en camino",
    bodyHtml: `<strong>${technicianName}</strong> va en camino para tu servicio de <strong>${serviceName}</strong>. Prepárate para recibirlo.`,
    cta: { label: "Ver estado en vivo", url: trackUrl },
  });
  const text = `${greeting},\n\n${technicianName} va en camino para tu servicio de ${serviceName}.\n\nVe el estado en vivo aquí:\n${trackUrl}\n\n— FixHub`;
  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${technicianName} va en camino — FixHub`,
    html,
    text,
  });
}

// Email al TÉCNICO cuando el cliente cancela un trabajo comprado.
export async function sendTechJobCancelledEmail(args: {
  to: string;
  technicianName: string;
  serviceName: string;
  cityName: string;
  refunded: boolean;
  refundAmount: number;
}) {
  const { to, technicianName, serviceName, cityName, refunded, refundAmount } = args;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fix-hub.company";
  const refundLine = refunded
    ? `Como cancelaron antes de la visita, te <strong>reembolsamos $${refundAmount} MXN</strong> a tu saldo automáticamente.`
    : `El trabajo ya estaba avanzado, así que no se aplicó reembolso automático. Si crees que corresponde, escríbenos.`;
  const html = clientShell({
    greeting: `Hola ${technicianName.split(" ")[0]}`,
    heading: "Un cliente canceló un servicio",
    bodyHtml: `El cliente canceló el servicio de <strong>${serviceName}</strong> en ${cityName}.<br><br>${refundLine}`,
    cta: { label: "Ir a mi panel", url: `${baseUrl}/panel` },
  });
  const text = `Hola ${technicianName.split(" ")[0]},\n\nEl cliente canceló el servicio de ${serviceName} en ${cityName}. ${refunded ? `Te reembolsamos $${refundAmount} MXN a tu saldo.` : "Sin reembolso automático."}\n\n— FixHub`;
  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Cliente canceló: ${serviceName} en ${cityName} — FixHub`,
    html,
    text,
  });
}

// Aviso al ADMIN cuando un cliente cancela.
export async function sendAdminCancellationNotification(args: {
  service: string;
  city: string;
  technicianName: string;
  refunded: boolean;
  refundAmount: number;
}) {
  if (!ADMIN_EMAIL) return;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fix-hub.company";
  const html = adminShell(
    "Cliente canceló un servicio",
    [
      { label: "Servicio", value: args.service },
      { label: "Ciudad", value: args.city },
      { label: "Técnico", value: args.technicianName },
      { label: "Reembolso", value: args.refunded ? `$${args.refundAmount} MXN (saldo)` : "No aplicado" },
    ],
    { label: "Ver leads", url: `${baseUrl}/admin/leads` }
  );
  const text = `Cliente canceló: ${args.service} en ${args.city}. Técnico: ${args.technicianName}. Reembolso: ${args.refunded ? `$${args.refundAmount} MXN` : "no"}.`;
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `❌ Cancelación: ${args.service} en ${args.city}`,
    html,
    text,
  });
}
