"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, Plus } from "lucide-react";
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
import { NotasTabela } from "@/components/notas/notas-tabela";
import { moeda } from "@/lib/format";
import { criarGuia } from "@/lib/notas/actions";
import { numeroGuia, type NotaResumo } from "@/lib/notas/tipos";

function CriarGuia({ notas, onCriada }: { notas: NotaResumo[]; onCriada: () => void }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [obs, setObs] = useState("");
  const [pending, startTransition] = useTransition();
  const obras = new Set(notas.map((n) => n.obra_id));
  const total = notas.reduce((s, n) => s + Number(n.valor), 0);

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          if (obras.size > 1) return toast.error("Selecione notas de uma única obra para montar a guia.");
          setAberto(true);
        }}
      >
        <FilePlus2 /> Montar guia com {notas.length} nota(s) · {moeda(total)}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Guia Adm</DialogTitle>
            <DialogDescription>
              Obra {notas[0]?.obra_codigo} — {notas[0]?.obra_nome} · {notas.length} nota(s) · {moeda(total)}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 overflow-auto rounded-md border text-sm">
            {notas.map((n) => (
              <li key={n.id} className="flex justify-between border-b p-2 last:border-0">
                <span>
                  NF {n.numero} · {n.fornecedor_nome}
                </span>
                <span className="tabular-nums">{moeda(Number(n.valor))}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-1.5">
            <Label htmlFor="obs-guia">Observação</Label>
            <Textarea id="obs-guia" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await criarGuia(notas[0].obra_id, notas.map((n) => n.id), obs);
                  if (!r.ok) return void toast.error(r.erro);
                  toast.success(`${numeroGuia(r.id!)} criada. Envie ao cliente em Guias Adm.`);
                  setAberto(false);
                  onCriada();
                  router.refresh();
                })
              }
            >
              {pending ? "Criando…" : "Criar guia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NotasAzulView({ notas, podeGuia, podeLancar }: { notas: NotaResumo[]; podeGuia: boolean; podeLancar: boolean }) {
  const [selecionadas, setSelecionadas] = useState<number[]>([]);

  return (
    <NotasTabela
      titulo="Notas Fase Azul"
      descricao="O cliente paga o fornecedor direto; a MPH acompanha e envia as guias."
      notas={notas}
      nomeArquivo="notas-fase-azul"
      abas={[
        { chave: "guia", rotulo: "Aguardando guia", status: ["aguardando_guia"] },
        { chave: "engenharia", rotulo: "Aguardando engenharia", status: ["aguardando_engenharia"] },
        { chave: "reprovadas", rotulo: "Reprovadas", status: ["reprovada"] },
        { chave: "em_guia", rotulo: "Em guia", status: ["em_guia"] },
        { chave: "pagas", rotulo: "Pagas", status: ["paga"] },
      ]}
      topo={
        podeLancar && (
          <Button render={<Link href="/notas/nova?fase=azul" />}>
            <Plus /> Anexar OC x NF
          </Button>
        )
      }
      selecao={
        podeGuia
          ? {
              aba: "guia",
              selecionadas,
              onChange: setSelecionadas,
              acao: (sel) => <CriarGuia notas={sel} onCriada={() => setSelecionadas([])} />,
            }
          : undefined
      }
    />
  );
}
