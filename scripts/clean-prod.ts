/**
 * Limpieza de prod DB — elimina SOLO datos demo y de prueba.
 *
 * Mantiene: catálogo (categorías, servicios, ciudades, zonas, marcas),
 * ServiceContent (textos SEO IA-generados), paquetes de recarga,
 * ProcessedWebhookEvent (anti-replay idempotencia).
 *
 * Borra: cuentas demo, prospects demo, leads de prueba (y todo lo
 * que dependa de ellos por cascada).
 *
 * Uso:
 *   DATABASE_URL=... DIRECT_URL=... pnpm tsx scripts/clean-prod.ts
 *   pnpm tsx scripts/clean-prod.ts --dry-run  (no borra, solo cuenta)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`🧹 FixHub prod cleanup ${DRY_RUN ? "(DRY RUN)" : "(REAL)"}\n`);

  const beforeCounts = await snapshot();
  console.log("Antes:");
  printCounts(beforeCounts);

  // ── 1. Cuentas demo y todo lo asociado ────────────────────────
  const demoEmails = ["admin@fixhub.mx", "tecnico@fixhub.mx"];
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    include: {
      technician: {
        include: {
          purchases: true,
          transactions: true,
        },
      },
      leads: true,
    },
  });

  console.log(`\n👥 Usuarios demo encontrados: ${demoUsers.length}`);
  for (const u of demoUsers) {
    const purchases = u.technician?.purchases.length ?? 0;
    const transactions = u.technician?.transactions.length ?? 0;
    const leads = u.leads.length;
    console.log(`   ${u.email} → ${purchases} compras, ${transactions} transacciones, ${leads} leads como cliente`);
  }

  if (!DRY_RUN && demoUsers.length > 0) {
    // El orden importa por las foreign keys
    for (const u of demoUsers) {
      if (u.technician) {
        // borrar leads que el técnico haya comprado (purchases cascade desde Technician)
        await prisma.balanceTransaction.deleteMany({ where: { technicianId: u.technician.id } });
        await prisma.leadPurchase.deleteMany({ where: { technicianId: u.technician.id } });
        await prisma.technicianCoverage.deleteMany({ where: { technicianId: u.technician.id } });
        await prisma.technicianService.deleteMany({ where: { technicianId: u.technician.id } });
        await prisma.technician.delete({ where: { id: u.technician.id } });
      }
      // borrar leads que él creó como cliente
      await prisma.lead.deleteMany({ where: { clientId: u.id } });
    }
    await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });
  }

  // ── 2. Prospects demo (las 4 sembradas) ───────────────────────
  const demoProspectSources = ["GoogleMaps_Scraper", "Facebook_Ad", "Referido", "QA_Test"];
  const demoProspects = await prisma.prospect.findMany({
    where: { source: { in: demoProspectSources } },
  });
  console.log(`\n🎯 Prospects demo encontrados: ${demoProspects.length}`);
  if (!DRY_RUN && demoProspects.length > 0) {
    await prisma.prospect.deleteMany({
      where: { source: { in: demoProspectSources } },
    });
  }

  // ── 3. Leads huérfanos de prueba ──────────────────────────────
  // Cualquier lead PURCHASED por los demo techs ya borramos arriba.
  // Quedan leads PENDING anónimos del cliente que probamos en dev.
  // Borrar todos los leads sin clientId que estén en status PENDING/EXPIRED
  // (los reales tendrían clientId atado a un User real cuando agreguemos signup de clientes).
  const orphanLeads = await prisma.lead.findMany({
    where: { clientId: null },
    include: { purchase: true },
  });
  console.log(`\n📋 Leads anónimos (sin clientId): ${orphanLeads.length}`);
  if (!DRY_RUN && orphanLeads.length > 0) {
    // borrar primero purchases relacionados
    const leadIds = orphanLeads.map((l) => l.id);
    await prisma.leadPurchase.deleteMany({ where: { leadId: { in: leadIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  }

  // ── 4. Webhook events viejos (>7 días) — housekeeping ──────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oldWebhooks = await prisma.processedWebhookEvent.count({
    where: { createdAt: { lt: sevenDaysAgo } },
  });
  console.log(`\n📬 Eventos webhook viejos (>7d): ${oldWebhooks}`);
  if (!DRY_RUN && oldWebhooks > 0) {
    await prisma.processedWebhookEvent.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    });
  }

  console.log("\n──────────────────────────────────────");
  const afterCounts = await snapshot();
  console.log("Después:");
  printCounts(afterCounts);

  console.log("\n──────────────────────────────────────");
  console.log("Diff:");
  for (const k of Object.keys(beforeCounts) as Array<keyof typeof beforeCounts>) {
    const diff = afterCounts[k] - beforeCounts[k];
    if (diff !== 0) {
      console.log(`  ${k}: ${beforeCounts[k]} → ${afterCounts[k]} (${diff > 0 ? "+" : ""}${diff})`);
    }
  }

  if (DRY_RUN) console.log("\n🧪 DRY RUN — no se borró nada. Quita --dry-run para ejecutar.");
  else console.log("\n✅ Limpieza completada.");
}

async function snapshot() {
  return {
    users: await prisma.user.count(),
    technicians: await prisma.technician.count(),
    leads: await prisma.lead.count(),
    leadPurchases: await prisma.leadPurchase.count(),
    balanceTransactions: await prisma.balanceTransaction.count(),
    prospects: await prisma.prospect.count(),
    categories: await prisma.category.count(),
    services: await prisma.service.count(),
    cities: await prisma.city.count(),
    zones: await prisma.zone.count(),
    brands: await prisma.brand.count(),
    serviceContents: await prisma.serviceContent.count(),
    rechargePackages: await prisma.rechargePackage.count(),
    processedWebhooks: await prisma.processedWebhookEvent.count(),
  };
}

function printCounts(c: Awaited<ReturnType<typeof snapshot>>) {
  const groups = [
    ["Usuarios", { users: c.users, technicians: c.technicians }],
    ["Leads", { leads: c.leads, purchases: c.leadPurchases, transactions: c.balanceTransactions }],
    ["Outbound", { prospects: c.prospects }],
    ["Catálogo (no se toca)", {
      categories: c.categories,
      services: c.services,
      cities: c.cities,
      zones: c.zones,
      brands: c.brands,
      serviceContent: c.serviceContents,
      packages: c.rechargePackages,
    }],
    ["Infraestructura", { webhookEvents: c.processedWebhooks }],
  ] as const;
  for (const [label, items] of groups) {
    console.log(`  ${label}:`);
    for (const [k, v] of Object.entries(items)) console.log(`    ${k}: ${v}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
