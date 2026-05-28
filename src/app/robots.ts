import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicBaseUrl();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/panel/", "/admin/", "/calificar/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
