import Link from "next/link";
import { Wrench, ArrowLeft } from "lucide-react";

type Props = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export function LegalLayout({ title, lastUpdated, children }: Props) {
  return (
    <main className="relative min-h-screen bg-slate-50/40">
      {/* Patrón dotted consistente con home */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
      />

      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-lg tracking-tight">FixHub</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al sitio
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Última actualización: {lastUpdated}
          </p>
        </div>

        <div className="prose-fixhub rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-[0_8px_30px_rgb(99,102,241,0.05)] backdrop-blur sm:p-10">
          {children}
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          ⚖️ Este documento es una plantilla. Antes de usarlo comercialmente, revísalo
          con un abogado mexicano para adaptarlo a tu modelo específico y a las
          últimas reformas de la LFPDPPP y la LFPC.
        </p>
      </article>
    </main>
  );
}
