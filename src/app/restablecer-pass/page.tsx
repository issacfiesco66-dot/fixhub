import { Suspense } from "react";
import { ResetForm } from "./_components/ResetForm";

// useSearchParams() en el child requiere Suspense + dynamic en Next 15
export const dynamic = "force-dynamic";

export default function RestablecerPassPage() {
  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-screen items-center justify-center p-4">
          <div className="text-sm text-zinc-500">Cargando...</div>
        </main>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
