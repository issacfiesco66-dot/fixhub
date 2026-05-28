import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Política de Cookies",
  description: "Información sobre el uso de cookies en FixHub.",
};

export default function CookiesPage() {
  return (
    <LegalLayout title="Política de Cookies" lastUpdated="27 de mayo de 2026">
      <p>
        Esta Política de Cookies describe qué son las cookies, cuáles utiliza
        FixHub y cómo puede gestionarlas. Complementa nuestro{" "}
        <a href="/privacidad">Aviso de Privacidad</a>.
      </p>

      <h2>1. ¿Qué son las cookies?</h2>
      <p>
        Las cookies son pequeños archivos de texto que un sitio web guarda en su
        dispositivo cuando lo visita. Permiten al sitio recordar sus acciones y
        preferencias durante un período determinado, para que no tenga que
        volver a configurarlas cada vez que regrese.
      </p>

      <h2>2. ¿Qué cookies usa FixHub?</h2>

      <h3>Cookies estrictamente necesarias</h3>
      <p>
        Son indispensables para el funcionamiento de la Plataforma. Sin ellas,
        servicios como el inicio de sesión o la compra de leads no funcionarían.
        No requieren consentimiento.
      </p>
      <ul>
        <li>
          <strong>fixhub_tech</strong> — JWT firmado que mantiene la sesión
          de un técnico autenticado. Duración: 30 días. <em>HttpOnly, Secure, SameSite=Lax</em>.
        </li>
        <li>
          <strong>fixhub_admin</strong> — JWT firmado que mantiene la sesión
          de un administrador. Duración: 12 horas. <em>HttpOnly, Secure, SameSite=Strict</em>.
        </li>
        <li>
          <strong>fixhub_cookie_consent</strong> — Recuerda si ya aceptó este
          aviso para no mostrarlo nuevamente. Duración: 180 días. <em>SameSite=Lax</em>.
        </li>
      </ul>

      <h3>Cookies de terceros</h3>
      <p>
        Cuando inicia un pago, Stripe puede colocar cookies propias en su
        navegador para procesar la transacción de forma segura.
      </p>
      <ul>
        <li>
          <strong>__stripe_mid, __stripe_sid</strong> y similares — Activadas
          únicamente al interactuar con Stripe Checkout. Consulte la{" "}
          <a href="https://stripe.com/cookie-settings" target="_blank" rel="noopener">
            política de cookies de Stripe
          </a>.
        </li>
      </ul>

      <h3>Lo que NO usamos</h3>
      <p>
        FixHub <strong>NO utiliza</strong>:
      </p>
      <ul>
        <li>Cookies de publicidad o seguimiento de terceros (Google Ads, Facebook Pixel, etc.).</li>
        <li>Cookies de analítica de comportamiento individualizado.</li>
        <li>Fingerprinting del dispositivo.</li>
      </ul>

      <h2>3. Cómo gestionar las cookies</h2>
      <p>
        Puede deshabilitar, bloquear o eliminar cookies desde la configuración
        de su navegador en cualquier momento. Tenga en cuenta que bloquear
        cookies estrictamente necesarias impedirá el correcto funcionamiento de
        la Plataforma (por ejemplo, no podrá iniciar sesión).
      </p>
      <p>Guías oficiales por navegador:</p>
      <ul>
        <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Google Chrome</a></li>
        <li><a href="https://support.mozilla.org/es/kb/proteccion-antirrastreo-mejorada-en-firefox" target="_blank" rel="noopener">Mozilla Firefox</a></li>
        <li><a href="https://support.apple.com/es-mx/guide/safari/sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
        <li><a href="https://support.microsoft.com/es-es/microsoft-edge" target="_blank" rel="noopener">Microsoft Edge</a></li>
      </ul>

      <h2>4. Cambios a esta política</h2>
      <p>
        Esta política puede actualizarse para reflejar cambios en nuestras
        prácticas o por requerimientos legales. Le recomendamos revisarla
        periódicamente. La fecha de última actualización aparece al inicio.
      </p>

      <h2>5. Contacto</h2>
      <p>
        Si tiene dudas sobre nuestro uso de cookies escríbanos a{" "}
        <a href="mailto:privacidad@fixhub.mx">privacidad@fixhub.mx</a>.
      </p>
    </LegalLayout>
  );
}
