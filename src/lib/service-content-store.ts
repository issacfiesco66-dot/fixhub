// Helpers para ServiceContent que manejan correctamente brandId nullable.
//
// Limitación de Prisma 5.x: findUnique/upsert con compound unique key
// donde un campo es nullable lanza "Argument must not be null" porque
// SQL trata NULL != NULL. Aquí abstraemos eso con findFirst + create/update.

import type { PrismaClient } from "@prisma/client";

type Ids = { serviceId: string; brandId: string | null; cityId: string };

type ContentData = {
  h1: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  body: string;
  source: "MANUAL" | "AI_GPT" | "AI_CLAUDE" | "TEMPLATE";
  reviewed?: boolean;
};

// findFirst que sirve tanto para brandId null como no-null.
export async function findServiceContent(prisma: PrismaClient, ids: Ids) {
  return prisma.serviceContent.findFirst({
    where: {
      serviceId: ids.serviceId,
      cityId: ids.cityId,
      brandId: ids.brandId, // findFirst SÍ acepta null
    },
  });
}

// Upsert manual que evita la limitación del compound unique key.
// Si existe → update por id; si no → create.
export async function upsertServiceContent(
  prisma: PrismaClient,
  ids: Ids,
  data: ContentData
) {
  const existing = await findServiceContent(prisma, ids);

  const payload = {
    h1: data.h1,
    metaTitle: data.metaTitle ?? null,
    metaDescription: data.metaDescription ?? null,
    body: data.body,
    source: data.source,
    reviewed: data.reviewed ?? false,
  };

  if (existing) {
    return prisma.serviceContent.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.serviceContent.create({
    data: {
      serviceId: ids.serviceId,
      brandId: ids.brandId,
      cityId: ids.cityId,
      ...payload,
    },
  });
}
