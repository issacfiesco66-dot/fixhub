import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Términos de Uso",
  description: "Términos y condiciones de uso de la plataforma FixHub.",
};

export default function TerminosPage() {
  return (
    <LegalLayout title="Términos de Uso" lastUpdated="27 de mayo de 2026">
      <p>
        Bienvenido a <strong>FixHub</strong> (en adelante, la <em>"Plataforma"</em>).
        Estos Términos de Uso (<em>"Términos"</em>) rigen el acceso y uso del sitio
        web <a href="/">https://fixhub.mx</a> y de los servicios ofrecidos a través
        del mismo. Al utilizar la Plataforma usted (<em>"Usuario"</em>) acepta
        haber leído, entendido y obligarse por estos Términos.
      </p>

      <h2>1. Identidad del operador</h2>
      <p>
        La Plataforma es operada por el titular comercial de FixHub, con domicilio
        en México. Para cualquier comunicación legal, contacto al correo:{" "}
        <a href="mailto:legal@fixhub.mx">legal@fixhub.mx</a>.
      </p>

      <h2>2. Naturaleza del servicio</h2>
      <p>
        FixHub es una plataforma de <strong>intermediación digital</strong> que
        conecta a personas que requieren un servicio técnico a domicilio
        (<em>"Clientes"</em>) con prestadores de servicios independientes
        (<em>"Técnicos"</em>) que ofrecen reparaciones, instalaciones y
        mantenimiento en sus áreas de cobertura.
      </p>
      <p>
        <strong>FixHub NO es empleador</strong> de los Técnicos ni presta
        directamente los servicios técnicos. La relación de servicio se establece
        directamente entre el Cliente y el Técnico. FixHub únicamente facilita
        el contacto a cambio del pago de una tarifa de lead por parte del Técnico.
      </p>

      <h2>3. Registro de cuentas</h2>
      <p>
        Para usar funciones específicas de la Plataforma, los Técnicos deben crear
        una cuenta proporcionando datos verídicos. Es responsabilidad del Usuario
        mantener la confidencialidad de sus credenciales y notificar
        inmediatamente cualquier uso no autorizado a{" "}
        <a href="mailto:soporte@fixhub.mx">soporte@fixhub.mx</a>.
      </p>
      <p>
        FixHub se reserva el derecho de suspender o cancelar cuentas que
        incumplan estos Términos, presenten información falsa o reciban
        calificaciones reiteradamente deficientes.
      </p>

      <h2>4. Obligaciones de los Técnicos</h2>
      <ul>
        <li>Contar con los conocimientos, herramientas y, en su caso, licencias necesarias para prestar el servicio ofrecido.</li>
        <li>Contactar al Cliente en un plazo máximo de 15 minutos tras adquirir un lead.</li>
        <li>Cumplir con las cotizaciones acordadas con el Cliente.</li>
        <li>Emitir el comprobante fiscal correspondiente por sus servicios.</li>
        <li>No utilizar los datos de contacto del Cliente para fines distintos al servicio solicitado.</li>
      </ul>

      <h2>5. Obligaciones de los Clientes</h2>
      <ul>
        <li>Proporcionar información veraz al solicitar un servicio.</li>
        <li>Pagar directamente al Técnico el monto acordado por el servicio.</li>
        <li>Tratar respetuosamente al personal técnico.</li>
        <li>Reportar a FixHub cualquier incidencia mediante{" "}
          <a href="mailto:soporte@fixhub.mx">soporte@fixhub.mx</a>.
        </li>
      </ul>

      <h2>6. Pagos y tarifa de leads</h2>
      <p>
        Los Técnicos cargan saldo en su cuenta de FixHub mediante procesador de
        pagos certificado <strong>Stripe</strong>. Cada lead tiene una tarifa
        publicada en la plataforma al momento de la compra. La tarifa se
        descuenta del saldo del Técnico al confirmar la compra del lead.
      </p>
      <p>
        El saldo no es transferible ni reembolsable, salvo en casos
        excepcionales evaluados por FixHub (ej. información del lead
        comprobadamente falsa). Los reembolsos, cuando procedan, se realizarán
        al mismo medio de pago original en un plazo de hasta 10 días hábiles.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        Todos los derechos sobre el contenido, marca, software y diseño de la
        Plataforma son propiedad de FixHub o sus licenciantes. Queda prohibido
        copiar, modificar o redistribuir cualquier parte del sitio sin
        autorización previa por escrito.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        FixHub actúa exclusivamente como intermediario. <strong>No garantiza
        la calidad, oportunidad ni resultado</strong> de los servicios prestados
        por los Técnicos. Cualquier reclamación derivada de la prestación del
        servicio debe dirigirse directamente al Técnico responsable.
      </p>
      <p>
        En ningún caso FixHub será responsable por daños indirectos, lucro
        cesante, pérdida de datos o daños morales derivados del uso o
        imposibilidad de uso de la Plataforma.
      </p>

      <h2>9. Modificaciones</h2>
      <p>
        FixHub puede modificar estos Términos en cualquier momento. Los cambios
        entrarán en vigor al publicarse en esta página. Se notificará a los
        usuarios registrados por correo electrónico al menos 10 días naturales
        antes de cambios sustanciales.
      </p>

      <h2>10. Protección al consumidor</h2>
      <p>
        Los Clientes en su carácter de consumidores tienen los derechos previstos
        en la <strong>Ley Federal de Protección al Consumidor</strong>. En caso
        de controversia podrán acudir a la Procuraduría Federal del Consumidor
        (PROFECO) o a las instancias judiciales competentes.
      </p>

      <h2>11. Tratamiento de datos personales</h2>
      <p>
        El tratamiento de los datos personales de los Usuarios se rige por
        nuestro <a href="/privacidad">Aviso de Privacidad</a>, que forma parte
        integrante de estos Términos.
      </p>

      <h2>12. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes vigentes en los Estados Unidos
        Mexicanos. Para la interpretación, cumplimiento y ejecución de los
        mismos, las partes se someten a la jurisdicción de los tribunales
        competentes del lugar donde tenga su domicilio el Cliente, renunciando
        a cualquier otro fuero que pudiera corresponderles.
      </p>

      <h2>13. Contacto</h2>
      <p>
        Para cualquier duda sobre estos Términos:{" "}
        <a href="mailto:legal@fixhub.mx">legal@fixhub.mx</a>
      </p>
    </LegalLayout>
  );
}
