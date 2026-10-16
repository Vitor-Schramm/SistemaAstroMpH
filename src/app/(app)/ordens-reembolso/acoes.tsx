"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DecisaoNota, PagarNota } from "@/components/notas/acoes-nota";
import { cancelarReembolso, decidirReembolso, enviarReembolso, pagarReembolso } from "@/lib/reembolsos/actions";
import { numeroReembolso, type ReembolsoResumo } from "@/lib/reembolsos/tipos";

/** Ações do reembolso conforme status e perfil. `podeEditar` libera enviar/cancelar. */
export function AcoesReembolso({
  r,
  podeAprovar,
  podePagar,
  podeEditar = false,
  compacto = false,
}: {
  r: ReembolsoResumo;
  podeAprovar: boolean;
  podePagar: boolean;
  podeEditar?: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ref = { id: r.id, numero: numeroReembolso(r.id), valor: Number(r.valor_total), fornecedor_nome: r.fornecedor_nome };
  const size = compacto ? "sm" : "default";

  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.erro);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="inline-flex flex-wrap justify-end gap-1">
      {podeEditar && (r.status === "rascunho" || r.status === "reprovada") && (
        <Button size={size} disabled={pending} onClick={() => executar(() => enviarReembolso(r.id), "Reembolso enviado para a engenharia.")}>
          <Send /> Enviar para aprovação
        </Button>
      )}
      {podeAprovar && r.status === "aguardando_aprovacao" && (
        <DecisaoNota nota={ref} compacto={compacto} decidir={decidirReembolso} rotulo="reembolso" />
      )}
      {podePagar && r.status === "aprovada" && <PagarNota nota={ref} compacto={compacto} pagar={pagarReembolso} rotulo="reembolso" />}
      {podeEditar && !["paga", "cancelada"].includes(r.status) && (
        <Button
          size={size}
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (confirm(`Cancelar ${numeroReembolso(r.id)}?`)) executar(() => cancelarReembolso(r.id), "Reembolso cancelado.");
          }}
        >
          <Ban /> Cancelar
        </Button>
      )}
    </div>
  );
}
