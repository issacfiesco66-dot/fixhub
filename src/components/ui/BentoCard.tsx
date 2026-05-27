import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
};

// Card primitiva premium estilo home: blanca con borde sutil, glass-friendly,
// shadow indigo difusa. Override con className si necesitas dark explícito.
export function BentoCard({ className, children, hover = false }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/80 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.08)] backdrop-blur",
        hover && "transition-all duration-200 hover:border-indigo-300 hover:shadow-[0_12px_40px_-10px_rgba(99,102,241,0.25)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoIcon({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: "indigo" | "emerald" | "amber" | "red" | "zinc";
}) {
  const tones = {
    indigo: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
    red: "bg-red-500/10 text-red-600 ring-red-500/20",
    zinc: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  } as const;
  return (
    <div
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1",
        tones[tone]
      )}
    >
      {children}
    </div>
  );
}
