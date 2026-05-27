import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
};

// Card primitiva premium. Por defecto: oscura (admin + panel del técnico viven en
// dark mode). Para usarla en light mode pasa el override por className.
export function BentoCard({ className, children, hover = false }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800/80 bg-zinc-900/70 shadow-bento-dark",
        hover && "transition-all duration-200 hover:border-brand-500/40 hover:shadow-glow-indigo",
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
    indigo: "bg-brand-500/15 text-brand-400 ring-brand-500/30",
    emerald: "bg-money-500/15 text-money-400 ring-money-500/30",
    amber: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    red: "bg-red-500/15 text-red-400 ring-red-500/30",
    zinc: "bg-zinc-700/40 text-zinc-300 ring-zinc-700/50",
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
