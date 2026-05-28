// Configuración global de la app (singleton AppConfig).
// Lectura sin escribir (default si no existe); escritura solo desde el admin.

import { prisma } from "./prisma";

const SINGLETON_ID = "singleton";
export const DEFAULT_FREE_LEADS = 3;

export async function getFreeLeadsLimit(): Promise<number> {
  const cfg = await prisma.appConfig.findUnique({
    where: { id: SINGLETON_ID },
    select: { freeLeadsLimit: true },
  });
  return cfg?.freeLeadsLimit ?? DEFAULT_FREE_LEADS;
}

export async function setFreeLeadsLimit(value: number) {
  return prisma.appConfig.upsert({
    where: { id: SINGLETON_ID },
    update: { freeLeadsLimit: value },
    create: { id: SINGLETON_ID, freeLeadsLimit: value },
  });
}
