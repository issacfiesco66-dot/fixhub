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
