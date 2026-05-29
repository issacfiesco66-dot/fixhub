import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/url";

// Crawlers de IA que queremos explícitamente DENTRO (GEO): que indexen el
// contenido público para citarnos en AI Overviews / ChatGPT / Perplexity, pero
// nunca las rutas privadas. Declararlos de forma explícita los marca como
// "managed" y deja claro que damos la bienvenida a la indexación por IA.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "FacebookBot",
];

const PRIVATE_PATHS = ["/api/", "/panel/", "/admin/", "/calificar/"];

export default function robots(): MetadataRoute.Robots {
  const base = getPublicBaseUrl();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
