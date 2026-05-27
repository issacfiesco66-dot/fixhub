import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    name: z.string().min(2).max(120),
    phone: z.string().min(8).max(20),
    email: z.string().email().optional().or(z.literal("")),
    city: z.string().min(1).max(80),
    source: z.string().min(1).max(80),
    notes: z.string().max(1000).optional(),
  })
  .strict();

// GET /api/admin/prospects?status=NEW&search=
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("search");

  const prospects = await prisma.prospect.findMany({
    where: {
      ...(status ? { status: status as "NEW" | "CONTACTED" | "CONVERTED" | "DISCARDED" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { city: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ prospects });
}

// POST /api/admin/prospects — crea o importa uno
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const prospect = await prisma.prospect.create({
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
    },
  });

  return NextResponse.json({ ok: true, prospect }, { status: 201 });
}
