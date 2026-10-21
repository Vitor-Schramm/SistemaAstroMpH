import { TriangleAlert } from "lucide-react";

export function AvisoReembolsos() {
  return (
    <div className="flex gap-2 rounded-[0.428rem] border border-amber-400/60 bg-amber-50 p-4 text-[1rem] dark:bg-amber-950/30">
      <TriangleAlert className="size-4 shrink-0 text-amber-600" />
      <div>
        A Ordem de Reembolso no modelo do original precisa da migração <b>0014_reembolsos_original.sql</b> (pasta supabase/migrations). Rode no SQL Editor do
        Supabase e recarregue a página.
      </div>
    </div>
  );
}

export const podeEditarReembolso = (papel: string) => ["admin", "engenharia", "suprimentos", "financeiro"].includes(papel);
