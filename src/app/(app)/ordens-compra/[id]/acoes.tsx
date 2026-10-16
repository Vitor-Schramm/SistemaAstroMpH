"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, FilePlus2, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelarOc, enviarOcAprovacao } from "@/lib/compras/actions";
import { numeroOC } from "@/lib/compras/tipos";

export function AcoesOc({ id, status, podeComprar }: { id: number; status: string; podeComprar: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const executar = (fn: () => Promise<{ ok: boolean; erro?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.erro);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => window.open(`/imprimir/oc/${id}`, "_blank")}>
        <Printer /> Imprimir / PDF
      </Button>
      {status === "aprovada" && (
        <Button render={<Link href={`/notas/nova?oc=${id}`} />}>
          <FilePlus2 /> Lançar nota fiscal
        </Button>
      )}
      {podeComprar && (status === "rascunho" || status === "reprovada") && (
        <Button disabled={pending} onClick={() => executar(() => enviarOcAprovacao(id), `${numeroOC(id)} enviada para aprovação.`)}>
          <Send /> Enviar para aprovação
        </Button>
      )}
      {podeComprar && status !== "cancelada" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (confirm(`Cancelar ${numeroOC(id)}?`)) executar(() => cancelarOc(id), `${numeroOC(id)} cancelada.`);
          }}
        >
          <Ban /> Cancelar OC
        </Button>
      )}
    </div>
  );
}
