import { Shield, Mail, User } from "lucide-react";
import { requireAdminOrRedirect } from "../_lib/auth-guard";
import { BentoCard, BentoIcon } from "@/components/ui/BentoCard";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const admin = await requireAdminOrRedirect();

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-zinc-900">
          <Shield className="h-7 w-7 text-indigo-600" />
          Mi perfil
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Información de tu cuenta y seguridad.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Info de cuenta */}
        <BentoCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <BentoIcon tone="indigo">
              <User className="h-4 w-4" />
            </BentoIcon>
            <div className="text-sm font-semibold text-zinc-900">Cuenta</div>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Nombre" value={admin.name ?? "—"} />
            <Row label="Email" value={admin.email} mono icon={<Mail className="h-3 w-3" />} />
            <Row label="Rol" value={admin.role} mono />
            <Row label="Creado" value={new Date(admin.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} />
          </div>
        </BentoCard>

        {/* Cambiar password */}
        <BentoCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <BentoIcon tone="amber">
              <Shield className="h-4 w-4" />
            </BentoIcon>
            <div>
              <div className="text-sm font-semibold text-zinc-900">Cambiar password</div>
              <div className="text-[11px] text-zinc-500">Recomendado tras crear la cuenta</div>
            </div>
          </div>
          <ChangePasswordForm />
        </BentoCard>
      </div>
    </div>
  );
}

function Row({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-zinc-900 ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {icon}
        {value}
      </span>
    </div>
  );
}
