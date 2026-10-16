"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { selectClass } from "@/components/cadastros/registro-form";
import { decidirOc } from "@/lib/compras/actions";
import { numeroOC } from "@/lib/compras/tipos";

const ROTULO_PAPEL = { engenharia: "Engenharia", financeiro: "Financeiro" } as const;

/** Botões Aprovar/Reprovar de uma OC. Admin escolhe por qual papel decide. */
export function DecisaoOc({
  ocId,
  papeis,
  pendentes,
  compacto = false,
}: {
  ocId: number;
  papeis: ("engenharia" | "financeiro")[];
  /** Papéis que ainda não decidiram (para sugerir o padrão do admin). */
  pendentes: ("engenharia" | "financeiro")[];
  compacto?: boolean;
}) {
  const router = useRouter();
  const [acao, setAcao] = useState<"aprovar" | "reprovar" | null>(null);
  const padrao = () => pendentes.find((p) => papeis.includes(p)) ?? papeis[0];
  const [papel, setPapel] = useState<"engenharia" | "financeiro">(padrao);
  const [justificativa, setJustificativa] = useState("");
  const [pending, startTransition] = useTransition();

  if (papeis.length === 0) return null;

  const confirmar = () => {
    if (acao === "reprovar" && !justificativa.trim()) return toast.error("Informe a justificativa da reprovação.");
    startTransition(async () => {
      const r = await decidirOc(ocId, acao === "aprovar", justificativa, papel);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`${numeroOC(ocId)} ${acao === "aprovar" ? "aprovada" : "reprovada"} por ${ROTULO_PAPEL[papel]}.`);
      setAcao(null);
      setJustificativa("");
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex gap-2">
        <Button size={compacto ? "sm" : "default"} onClick={() => {
            setPapel(padrao());
            setAcao("aprovar");
          }} disabled={pending}>
          <Check /> Aprovar
        </Button>
        <Button size={compacto ? "sm" : "default"} variant="destructive" onClick={() => {
            setPapel(padrao());
            setAcao("reprovar");
          }} disabled={pending}>
          <X /> Reprovar
        </Button>
      </div>

      <Dialog open={acao !== null} onOpenChange={(o) => !o && setAcao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acao === "aprovar" ? "Aprovar" : "Reprovar"} {numeroOC(ocId)}
            </DialogTitle>
            <DialogDescription>
              A OC é aprovada quando Engenharia e Financeiro aprovam. Uma reprovação devolve a OC para compras.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {papeis.length > 1 && (
              <div className="grid gap-1.5">
                <Label htmlFor="papel">Decidir como</Label>
                <select id="papel" value={papel} onChange={(e) => setPapel(e.target.value as typeof papel)} className={selectClass}>
                  {papeis.map((p) => (
                    <option key={p} value={p}>
                      {ROTULO_PAPEL[p]}
                      {pendentes.includes(p) ? "" : " (já decidido — substituir)"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="just">
                Justificativa{acao === "reprovar" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea id="just" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button variant={acao === "reprovar" ? "destructive" : "default"} onClick={confirmar} disabled={pending}>
              {pending ? "Enviando…" : acao === "aprovar" ? "Confirmar aprovação" : "Confirmar reprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
