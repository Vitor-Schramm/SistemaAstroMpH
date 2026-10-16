import { cn } from "@/lib/utils";
import type { Tom } from "@/lib/compras/tipos";

const tons: Record<Tom, string> = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  alerta: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300",
  erro: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  neutro: "bg-muted text-muted-foreground",
};

export function StatusBadge({ mapa, valor }: { mapa: Record<string, { rotulo: string; tom: Tom }>; valor: string }) {
  const s = mapa[valor] ?? { rotulo: valor, tom: "neutro" as Tom };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tons[s.tom])}>
      {s.rotulo}
    </span>
  );
}
