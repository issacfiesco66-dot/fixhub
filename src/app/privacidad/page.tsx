import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Aviso de Privacidad",
  description: "Aviso de privacidad de FixHub conforme a la LFPDPPP de México.",
};

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Aviso de Privacidad" lastUpdated="27 de mayo de 2026">
      <p>
        El presente Aviso de Privacidad se emite en cumplimiento de la
        <strong> Ley Federal de Protección de Datos Personales en Posesión de los
        Particulares</strong> (LFPDPPP) y su Reglamento. Le informa cómo
        FixHub recaba, usa y protege sus datos personales.
      </p>

      <h2>1. Identidad y domicilio del Responsable</h2>
      <p>
        <strong>FixHub</strong> (en adelante, el "Responsable"), con domicilio
        para oír y recibir notificaciones en México, es el responsable del
        tratamiento de sus datos personales.
      </p>
      <p>
        Contacto para asuntos de privacidad:{" "}
        <a href="mailto:privacidad@fixhub.mx">privacidad@fixhub.mx</a>
      </p>

      <h2>2. Datos personales que recabamos</h2>
      <h3>De Clientes (solicitantes de servicio)</h3>
      <ul>
        <li>Nombre completo</li>
        <li>Número telefónico de contacto</li>
        <li>Correo electrónico (opcional)</li>
        <li>Ciudad, zona y referencia aproximada del domicilio</li>
        <li>Descripción del problema o servicio requerido</li>
      </ul>
      <h3>De Técnicos (prestadores de servicio)</h3>
      <ul>
        <li>Nombre completo</li>
        <li>Correo electrónico y contraseña</li>
        <li>Número telefónico</li>
        <li>Nombre profesional o comercial</li>
        <li>Ciudades de cobertura y servicios que ofrece</li>
        <li>Años de experiencia y biografía profesional</li>
        <li>Datos de identificación (para verificación)</li>
      </ul>
      <h3>Datos sensibles</h3>
      <p>
        FixHub <strong>no solicita ni almacena</strong> datos personales
        considerados sensibles conforme al artículo 3, fracción VI de la LFPDPPP
        (origen racial, salud, creencias, preferencias sexuales, etc.).
      </p>

      <h2>3. Finalidades del tratamiento</h2>
      <h3>Finalidades primarias (necesarias)</h3>
      <ol>
        <li>Conectar a Clientes con Técnicos disponibles en su zona y servicio solicitado.</li>
        <li>Crear y mantener la cuenta del Usuario en la Plataforma.</li>
        <li>Procesar pagos a través del proveedor Stripe.</li>
        <li>Brindar soporte y atención a incidencias.</li>
        <li>Cumplir con obligaciones fiscales y legales aplicables.</li>
      </ol>
      <h3>Finalidades secundarias (opcionales)</h3>
      <ol>
        <li>Envío de comunicaciones promocionales sobre nuevos servicios.</li>
        <li>Encuestas de satisfacción.</li>
        <li>Mejora estadística de la plataforma (datos anonimizados).</li>
      </ol>
      <p>
        Si no desea recibir tratamientos para las finalidades secundarias, puede
        manifestarlo escribiendo a{" "}
        <a href="mailto:privacidad@fixhub.mx">privacidad@fixhub.mx</a>.
      </p>

      <h2>4. Transferencias de datos</h2>
      <p>
        Sus datos personales <strong>pueden ser transferidos</strong> a:
      </p>
      <ul>
        <li><strong>Técnicos verificados</strong> de la red FixHub que adquieran el lead correspondiente (nombre, teléfono y ubicación aproximada del Cliente, exclusivamente para prestar el servicio solicitado).</li>
        <li><strong>Stripe Payments Mexico</strong>, S. de R.L. de C.V. (procesador de pagos certificado PCI-DSS).</li>
        <li><strong>Vercel Inc.</strong> y <strong>Neon Inc.</strong> (proveedores de infraestructura y base de datos, ubicados en EE. UU.).</li>
        <li>Autoridades competentes cuando exista requerimiento legal.</li>
      </ul>
      <p>
        Las transferencias se realizan únicamente para las finalidades primarias
        descritas. FixHub no comercializa sus datos personales con terceros.
      </p>

      <h2>5. Derechos ARCO</h2>
      <p>
        Como titular de los datos, usted tiene derecho a:
      </p>
      <ul>
        <li><strong>Acceder</strong> a los datos personales que tenemos sobre usted.</li>
        <li><strong>Rectificar</strong> datos inexactos o incompletos.</li>
        <li><strong>Cancelar</strong> sus datos cuando considere que no están siendo utilizados conforme a las finalidades.</li>
        <li><strong>Oponerse</strong> al tratamiento para finalidades específicas.</li>
      </ul>
      <p>
        Para ejercer cualquier derecho ARCO envíe una solicitud al correo{" "}
        <a href="mailto:privacidad@fixhub.mx">privacidad@fixhub.mx</a>{" "}
        incluyendo: (1) nombre completo y correo registrado, (2) descripción
        clara del derecho que desea ejercer, (3) cualquier documento que
        acredite su identidad. Daremos respuesta en un plazo máximo de 20 días
        hábiles conforme al artículo 32 de la LFPDPPP.
      </p>

      <h2>6. Revocación del consentimiento</h2>
      <p>
        En cualquier momento puede revocar el consentimiento que nos ha otorgado
        para el tratamiento de sus datos personales. Sin embargo, ciertas
        finalidades primarias requieren tratamiento continuo para mantener el
        servicio activo; en esos casos la revocación implicará la cancelación
        de su cuenta.
      </p>

      <h2>7. Medios automatizados y cookies</h2>
      <p>
        La Plataforma utiliza cookies estrictamente necesarias para mantener su
        sesión y proteger la seguridad de su cuenta. No utilizamos cookies de
        publicidad ni de seguimiento de terceros. Para más detalle consulte
        nuestra <a href="/cookies">Política de Cookies</a>.
      </p>

      <h2>8. Medidas de seguridad</h2>
      <p>
        FixHub implementa medidas técnicas, administrativas y físicas razonables
        para proteger sus datos:
      </p>
      <ul>
        <li>Cifrado TLS 1.3 en todas las comunicaciones.</li>
        <li>Cifrado en reposo de la base de datos.</li>
        <li>Hashing de contraseñas con bcrypt (cost factor 12).</li>
        <li>Sesiones autenticadas con JWT firmado (jose HS256).</li>
        <li>Cookies con flags <code>HttpOnly</code> y <code>Secure</code>.</li>
        <li>Control de acceso por roles (admin / técnico / público).</li>
      </ul>

      <h2>9. Cambios al Aviso de Privacidad</h2>
      <p>
        FixHub podrá modificar este Aviso. Los cambios serán publicados en esta
        misma URL con la fecha de "Última actualización". Le notificaremos por
        correo electrónico cualquier cambio sustancial.
      </p>

      <h2>10. INAI</h2>
      <p>
        Si considera que su derecho a la protección de datos personales ha sido
        vulnerado, puede presentar una queja ante el Instituto Nacional de
        Transparencia, Acceso a la Información y Protección de Datos Personales
        (INAI) en <a href="https://home.inai.org.mx/" target="_blank" rel="noopener">www.inai.org.mx</a>.
      </p>
    </LegalLayout>
  );
}
