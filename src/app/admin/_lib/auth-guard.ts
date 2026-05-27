import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";

// Helper para páginas dentro de /admin/* — redirige a /admin/login
// si no hay sesión admin válida.
export async function requireAdminOrRedirect() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
