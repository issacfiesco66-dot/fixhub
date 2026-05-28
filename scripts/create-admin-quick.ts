/**
 * One-off para crear admin con credenciales pasadas por env var.
 * Útil cuando no puedes correr el interactivo (CI, scripts remotos).
 *
 * Uso:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... \
 *     pnpm tsx scripts/create-admin-quick.ts
 *
 * NOTA: NO valida fortaleza del password — el operador es responsable
 * (vs scripts/create-admin.ts que sí valida en CLI interactivo).
 * Para producción usa el interactivo y guarda el password de inmediato.
 */

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    console.error("❌ Faltan ADMIN_EMAIL o ADMIN_PASSWORD");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("❌ Password muy corto (mín 8 chars)");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: UserRole.ADMIN },
    create: { email, passwordHash, name, role: UserRole.ADMIN },
  });

  console.log(`✅ Admin ${user.id} (${user.email}) creado/actualizado.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
