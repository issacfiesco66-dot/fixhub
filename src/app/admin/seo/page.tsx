import { prisma } from "@/lib/prisma";
import { requireAdminOrRedirect } from "../_lib/auth-guard";
import { SeoClient } from "./_components/SeoClient";

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  await requireAdminOrRedirect();

  // Cargar el catálogo completo + contenidos existentes
  const [services, brands, cities, contents] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      include: { brands: { include: { brand: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.city.findMany({
      where: { active: true },
      include: { state: true, zones: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceContent.findMany({
      include: { service: true, brand: true, city: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Generar todas las tuplas posibles (service × brand[s|null] × city)
  type Tuple = {
    serviceId: string;
    serviceName: string;
    serviceSlug: string;
    brandId: string | null;
    brandName: string | null;
    brandSlug: string | null;
    cityId: string;
    cityName: string;
    citySlug: string;
    stateName: string;
    zones: string[];
    content: (typeof contents)[number] | null;
  };

  const tuples: Tuple[] = [];
  for (const sv of services) {
    const svBrands = sv.requiresBrand ? sv.brands.map((sb) => sb.brand) : [null];
    for (const b of svBrands) {
      for (const ct of cities) {
        const match = contents.find(
          (c) =>
            c.serviceId === sv.id &&
            c.cityId === ct.id &&
            (c.brandId ?? null) === (b?.id ?? null)
        );
        tuples.push({
          serviceId: sv.id,
          serviceName: sv.name,
          serviceSlug: sv.slug,
          brandId: b?.id ?? null,
          brandName: b?.name ?? null,
          brandSlug: b?.slug ?? null,
          cityId: ct.id,
          cityName: ct.name,
          citySlug: ct.slug,
          stateName: ct.state.name,
          zones: ct.zones.map((z) => z.name),
          content: match ?? null,
        });
      }
    }
  }

  return <SeoClient tuples={tuples} totalContents={contents.length} />;
}
