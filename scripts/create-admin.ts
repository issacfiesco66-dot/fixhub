/**
 * Creación de admin en producción.
 *
 * Uso:
 *   pnpm tsx scripts/create-admin.ts
 *
 * Pide email + password por stdin (password con echo apagado).
 * Valida fortaleza mínima del password antes de hashear.
 *
 * Esto reemplaza al seed demo para entornos productivos donde
 * FIXHUB_SEED_DEMO debe estar en "false".
 */

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const prisma = new PrismaClient();
const BCRYPT_COST = 12; // OWASP 2024 recomendación mínima

// Política de password — alineada con OWASP ASVS L2
function validatePassword(pw: string): string | null {
  if (pw.length < 12) return "Mínimo 12 caracteres.";
  if (!/[a-z]/.test(pw)) return "Debe incluir al menos una minúscula.";
  if (!/[A-Z]/.test(pw)) return "Debe incluir al menos una mayúscula.";
  if (!/[0-9]/.test(pw)) return "Debe incluir al menos un número.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Debe incluir al menos un símbolo.";
  // Lista mínima de passwords conocidos comprometidos
  const blacklist = ["password", "admin", "fixhub", "demo1234", "qwerty", "12345678"];
  if (blacklist.some((b) => pw.toLowerCase().includes(b))) {
    return "Password contiene una palabra común comprometida.";
  }
  return null;
}

function ask(prompt: string, silent = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output, terminal: true });
    if (silent) {
      // Apagar echo durante lectura del password
      const stdin = input as NodeJS.ReadStream & { isTTY?: boolean };
      // En Windows / TTY moderno: muteamos a mano
      // @ts-expect-error _writeToOutput es interno pero estable
      rl._writeToOutput = (s: string) => {
        if (s === prompt || s.includes("\n")) output.write(s);
        else output.write("*");
      };
    }
    rl.question(prompt, (answer) => {
      rl.close();
      if (silent) output.write("\n");
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n🔐 FixHub — crear cuenta admin\n");

  const email = await ask("Email del admin: ");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("❌ Email inválido.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const conf = await ask(`⚠️  Ya existe usuario con ese email (rol: ${existing.role}). ¿Resetear password? (y/N): `);
    if (conf.toLowerCase() !== "y") {
      console.log("Cancelado.");
      process.exit(0);
    }
  }

  const name = await ask("Nombre completo: ");

  let password = "";
  while (true) {
    password = await ask("Password (oculto): ", true);
    const err = validatePassword(password);
    if (err) {
      console.error(`❌ ${err}`);
      continue;
    }
    const confirm = await ask("Confirma password: ", true);
    if (confirm !== password) {
      console.error("❌ Passwords no coinciden, intenta de nuevo.");
      continue;
    }
    break;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: name || existing?.name || null, role: UserRole.ADMIN },
    create: { email, passwordHash, name: name || null, role: UserRole.ADMIN },
  });

  console.log(`\n✅ Admin ${existing ? "actualizado" : "creado"}: ${email}`);
  console.log("   Borra cualquier traza del password del historial del shell.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
