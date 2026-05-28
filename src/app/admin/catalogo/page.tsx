import { prisma } from "@/lib/prisma";
import { requireAdminOrRedirect } from "../_lib/auth-guard";
import { CatalogClient } from "./_components/CatalogClient";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requireAdminOrRedirect();

  const [services, categories, brands, cities, states] = await Promise.all([
    prisma.service.findMany({
      orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true } },
        brands: { select: { brandId: true } },
        _count: { select: { leads: true, technicians: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { services: true } } },
    }),
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { services: true, leads: true } } },
    }),
    prisma.city.findMany({
      orderBy: { name: "asc" },
      include: {
        state: { select: { id: true, name: true } },
        _count: { select: { leads: true, zones: true, coverages: true } },
      },
    }),
    prisma.state.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <CatalogClient
      initialServices={services.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description,
        categoryId: s.categoryId,
        categoryName: s.category.name,
        requiresBrand: s.requiresBrand,
        basePrice: s.basePrice,
        active: s.active,
        brandIds: s.brands.map((b) => b.brandId),
        leadCount: s._count.leads,
        technicianCount: s._count.technicians,
      }))}
      initialCategories={categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        icon: c.icon,
        order: c.order,
        active: c.active,
        serviceCount: c._count.services,
      }))}
      initialBrands={brands.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        logo: b.logo,
        active: b.active,
        serviceCount: b._count.services,
        leadCount: b._count.leads,
      }))}
      initialCities={cities.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        stateId: c.stateId,
        stateName: c.state.name,
        active: c.active,
        latitude: c.latitude,
        longitude: c.longitude,
        phone: c.phone,
        leadCount: c._count.leads,
        zoneCount: c._count.zones,
        coverageCount: c._count.coverages,
      }))}
      states={states.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
    />
  );
}
