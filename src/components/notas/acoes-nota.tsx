"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, HandCoins, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { moeda } from "@/lib/format";
import { decidirNota, estornarPagamento, pagarNota } from "@/lib/notas/actions";

type Nota = { id: number; numero: string; valor: number; fornecedor_nome: string };

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Aprovar / reprovar uma NF (engenharia). */
export function DecisaoNota({ nota, compacto = false }: { nota: Nota; compacto?: boolean }) {
  const router = useRouter();
  const [acao, setAcao] = useState<"aprovar" | "reprovar" | null>(null);
  const [just, setJust] = useState("");
  const [pending, startTransition] = useTransition();

  const confirmar = () => {
    if (acao === "reprovar" && !just.trim()) return toast.error("Informe a justificativa da reprovação.");
    startTransition(async () => {
      const r = await decidirNota(nota.id, acao === "aprovar", just);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`Nota ${nota.numero} ${acao === "aprovar" ? "aprovada" : "reprovada"}.`);
      setAcao(null);
      setJust("");
      router.refresh();
    });
  };

  return (
    <>
      <div className="inline-flex gap-1">
        <Button size={compacto ? "sm" : "default"} onClick={() => setAcao("aprovar")} disabled={pending}>
          <Check /> Aprovar
        </Button>
        <Button size={compacto ? "sm" : "default"} variant="destructive" onClick={() => setAcao("reprovar")} disabled={pending}>
          <X /> Reprovar
        </Button>
      </div>
      <Dialog open={acao !== null} onOpenChange={(o) => !o && setAcao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acao === "aprovar" ? "Aprovar" : "Reprovar"} nota {nota.numero}
            </DialogTitle>
            <DialogDescription>
              {nota.fornecedor_nome} · {moeda(Number(nota.valor))}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`just-${nota.id}`}>
              Justificativa{acao === "reprovar" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea id={`just-${nota.id}`} rows={3} value={just} onChange={(e) => setJust(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button variant={acao === "reprovar" ? "destructive" : "default"} onClick={confirmar} disabled={pending}>
              {pending ? "Enviando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Efetivar pagamento (Fase Cinza), com fluxo de pagamento forçado quando falta verba. */
export function PagarNota({ nota, compacto = false }: { nota: Nota; compacto?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [faltaVerba, setFaltaVerba] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pagar = (forcar: boolean) =>
    startTransition(async () => {
      const r = await pagarNota(nota.id, data, forcar);
      if (!r.ok) {
        if (r.verbaInsuficiente) return void setFaltaVerba(r.erro);
        return void toast.error(r.erro);
      }
      toast.success(`Pagamento da nota ${nota.numero} efetivado${forcar ? " (forçado)" : ""}.`);
      setAberto(false);
      setFaltaVerba(null);
      router.refresh();
    });

  return (
    <>
      <Button size={compacto ? "sm" : "default"} onClick={() => setAberto(true)}>
        <HandCoins /> Efetivar
      </Button>
      <Dialog
        open={aberto}
        onOpenChange={(o) => {
          setAberto(o);
          if (!o) setFaltaVerba(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{faltaVerba ? "Efetivar pagamento com falta de verba alocada?" : "Efetivar pagamento?"}</DialogTitle>
            <DialogDescription>
              Nota {nota.numero} · {nota.fornecedor_nome} · <span className="font-medium">{moeda(Number(nota.valor))}</span>
            </DialogDescription>
          </DialogHeader>
          {faltaVerba && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {faltaVerba}
              <br />O pagamento ficará marcado como <b>forçado</b> e a verba da obra ficará negativa.
            </p>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`data-${nota.id}`}>Data do pagamento</Label>
            <Input id={`data-${nota.id}`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            {faltaVerba ? (
              <Button variant="destructive" onClick={() => pagar(true)} disabled={pending}>
                {pending ? "Efetivando…" : "Forçar pagamento"}
              </Button>
            ) : (
              <Button onClick={() => pagar(false)} disabled={pending}>
                {pending ? "Efetivando…" : "Efetivar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EstornarNota({ nota }: { nota: Nota }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Estornar o pagamento da nota ${nota.numero}? Ela volta para pendente.`)) return;
        startTransition(async () => {
          const r = await estornarPagamento(nota.id);
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Pagamento estornado.");
          router.refresh();
        });
      }}
    >
      <Undo2 /> Estornar pagamento
    </Button>
  );
}
