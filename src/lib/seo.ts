// Helpers para Geo-SEO: JSON-LD LocalBusiness + prompt template para IA.

type CityWithZones = {
  name: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  zones: { name: string }[];
  state: { name: string };
};

type LocalBusinessParams = {
  url: string;
  name: string;
  description: string;
  city: CityWithZones;
  // Limitar zones a las top N para no inflar el schema
  zonesLimit?: number;
};

// Genera el JSON-LD LocalBusiness que va dentro de <script type="application/ld+json">.
// Sigue el patrón del PDF (sección 5) — clave para que Google asocie cada
// página con una entidad geolocalizada real ("cerca de mí").
export function buildLocalBusinessJsonLd({
  url,
  name,
  description,
  city,
  zonesLimit = 8,
}: LocalBusinessParams) {
  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description,
    url,
    address: {
      "@type": "PostalAddress",
      addressLocality: city.name,
      addressRegion: city.state.name,
      addressCountry: "MX",
    },
    priceRange: "$$",
  };

  if (city.phone) json.telephone = city.phone;

  if (city.latitude != null && city.longitude != null) {
    json.geo = {
      "@type": "GeoCoordinates",
      latitude: city.latitude,
      longitude: city.longitude,
    };
  }

  if (city.zones.length > 0) {
    json.areaServed = city.zones.slice(0, zonesLimit).map((z) => z.name);
  }

  return json;
}

// JSON-LD a nivel de marca para la home: Organization + WebSite en un @graph.
// Es la entidad raíz que Google/IA asocian con "FixHub" (Knowledge Panel,
// citaciones en AI Overviews/ChatGPT/Perplexity). El entity_checker del audit
// fallaba con "No Organization/Person entity found" porque la home no tenía
// ningún JSON-LD (solo las landings programáticas lo tenían a nivel LocalBusiness).
//
// `logo` apunta a /logo.png (512×512, marca real). `sameAs` se omite mientras
// no existan perfiles sociales verificados (pásalos para activarlos y maximizar
// elegibilidad de Knowledge Panel).
export function buildSiteJsonLd({
  baseUrl,
  description,
  email,
  sameAs = [],
}: {
  baseUrl: string;
  description: string;
  email?: string | null;
  sameAs?: string[];
}) {
  const orgId = `${baseUrl}/#organization`;

  const organization: Record<string, unknown> = {
    "@type": "Organization",
    "@id": orgId,
    name: "FixHub",
    url: baseUrl,
    description,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/logo.png`,
      width: 512,
      height: 512,
    },
    image: `${baseUrl}/images/hero.png`,
    areaServed: { "@type": "Country", name: "México" },
  };
  if (email) {
    organization.contactPoint = {
      "@type": "ContactPoint",
      email,
      contactType: "customer support",
      areaServed: "MX",
      availableLanguage: ["es"],
    };
  }
  if (sameAs.length > 0) organization.sameAs = sameAs;

  const website = {
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    url: baseUrl,
    name: "FixHub",
    description,
    inLanguage: "es-MX",
    publisher: { "@id": orgId },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website],
  };
}

// Prompt template para generación masiva con LLM — referenciado desde el
// admin para copy/paste o desde un script de generación.
// Diseñado para producir ~150 palabras únicas por tupla (service × brand × city).
export function buildContentPrompt(args: {
  serviceName: string;
  brandName: string | null;
  cityName: string;
  stateName: string;
  zones: string[];
}) {
  const { serviceName, brandName, cityName, stateName, zones } = args;
  const brandLine = brandName
    ? `Marca: ${brandName}\n`
    : "Marca: (servicio sin marca específica)\n";
  const zonesStr = zones.slice(0, 6).join(", ") || "todas las zonas";

  return `Escribe un texto de 150 palabras completamente único y profesional para una landing page de servicios técnicos.

Servicio: ${serviceName}
${brandLine}Ubicación: ${cityName}, ${stateName} (Enfocado en las zonas de ${zonesStr})

Requisitos estrictos de SEO Local:
1. Habla sobre fallas comunes${brandName ? ` de ${brandName}` : ""} (ej. códigos de error en displays o ruidos en transmisión).
2. Menciona la importancia de realizar reparaciones a domicilio en ${cityName} usando refacciones originales.
3. Termina con un llamado a la acción urgente y directo para solicitar la visita de un técnico certificado local.
4. NO repitas frases textuales con otras ciudades. Usa referencias locales propias de ${cityName} y sus zonas.
5. Tono: profesional, cercano, sin tecnicismos innecesarios.

Devuelve solo el texto, sin encabezados ni meta-comentarios.`;
}
