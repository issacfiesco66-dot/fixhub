// Sesiones via cookies firmadas con HS256 (JWT). El cookie YA NO es el ID
// raw del usuario — es un JWT opaco que firma `{ sub, role, iat, exp }`.
// Si la firma no valida (key rotada, manipulación), getCurrent*() devuelve null.
//
// Reemplazar por NextAuth/Auth.js cuando integres OAuth/magic-links.

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const TECH_COOKIE = "fixhub_tech";
const ADMIN_COOKIE = "fixhub_admin";
const SESSION_DAYS_TECH = 30;
const SESSION_HOURS_ADMIN = 12; // admins tienen sesiones cortas — blast radius alto

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET no configurado o < 32 chars. Genera con: openssl rand -base64 32");
  }
  return new TextEncoder().encode(s);
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function sign(payload: { sub: string; role: "TECH" | "ADMIN" }, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

async function verify<T extends { sub: string; role: "TECH" | "ADMIN" }>(
  token: string,
  expectedRole: T["role"]
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.role !== expectedRole) return null;
    return payload as unknown as T;
  } catch {
    return null;
  }
}

// ── Técnico ────────────────────────────────────────────────────
export async function getCurrentTechnician() {
  const token = (await cookies()).get(TECH_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify<{ sub: string; role: "TECH" }>(token, "TECH");
  if (!payload) return null;
  return prisma.technician.findUnique({
    where: { id: payload.sub },
    include: {
      user: true,
      coverages: { include: { city: true } },
      services: { include: { service: true } },
    },
  });
}

export async function setTechnicianSession(techId: string) {
  const token = await sign({ sub: techId, role: "TECH" }, `${SESSION_DAYS_TECH}d`);
  (await cookies()).set(TECH_COOKIE, token, {
    ...cookieOpts,
    maxAge: 60 * 60 * 24 * SESSION_DAYS_TECH,
  });
}

export async function clearTechnicianSession() {
  (await cookies()).delete(TECH_COOKIE);
}

// ── Admin ──────────────────────────────────────────────────────
export async function getCurrentAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify<{ sub: string; role: "ADMIN" }>(token, "ADMIN");
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function setAdminSession(userId: string) {
  const token = await sign({ sub: userId, role: "ADMIN" }, `${SESSION_HOURS_ADMIN}h`);
  (await cookies()).set(ADMIN_COOKIE, token, {
    ...cookieOpts,
    sameSite: "strict", // admin: SameSite=Strict para extra protección
    maxAge: 60 * 60 * SESSION_HOURS_ADMIN,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
