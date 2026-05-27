// Stub de auth — para MVP usamos cookies firmadas con el ID de la entidad.
// Reemplazar por NextAuth/Auth.js cuando se integre flujo completo.
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const TECH_COOKIE = "fixhub_tech";
const ADMIN_COOKIE = "fixhub_admin";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

// ── Técnico ────────────────────────────────────────────────────
export async function getCurrentTechnician() {
  const c = await cookies();
  const techId = c.get(TECH_COOKIE)?.value;
  if (!techId) return null;
  return prisma.technician.findUnique({
    where: { id: techId },
    include: {
      user: true,
      coverages: { include: { city: true } },
      services: { include: { service: true } },
    },
  });
}

export async function setTechnicianSession(techId: string) {
  const c = await cookies();
  c.set(TECH_COOKIE, techId, cookieOpts);
}

export async function clearTechnicianSession() {
  const c = await cookies();
  c.delete(TECH_COOKIE);
}

// ── Admin ──────────────────────────────────────────────────────
export async function getCurrentAdmin() {
  const c = await cookies();
  const adminId = c.get(ADMIN_COOKIE)?.value;
  if (!adminId) return null;
  const user = await prisma.user.findUnique({ where: { id: adminId } });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function setAdminSession(userId: string) {
  const c = await cookies();
  c.set(ADMIN_COOKIE, userId, cookieOpts);
}

export async function clearAdminSession() {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}
