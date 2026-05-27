import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Si la BD no está disponible (primer build en Vercel), devolvemos solo
  // la home. Cuando reconstruyas con DATABASE_URL, las 200+ URLs se incluyen.
  let services, cities;
  try {
    [services, cities] = await Promise.all([
      prisma.service.findMany({ where: { active: true }, include: { brands: { include: { brand: true } } } }),
      prisma.city.findMany({ where: { active: true } }),
    ]);
  } catch {
    return [{ url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
  }

  const urls: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];

  for (const sv of services) {
    urls.push({
      url: `${base}/${sv.slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    for (const city of cities) {
      urls.push({
        url: `${base}/${sv.slug}-${city.slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      if (sv.requiresBrand) {
        for (const sb of sv.brands) {
          urls.push({
            url: `${base}/${sv.slug}-${sb.brand.slug}-${city.slug}`,
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      }
    }
  }

  return urls;
}
