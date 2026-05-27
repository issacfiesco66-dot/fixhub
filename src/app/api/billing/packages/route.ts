import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const packages = await prisma.rechargePackage.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ packages });
}
