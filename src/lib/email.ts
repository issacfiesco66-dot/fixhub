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
