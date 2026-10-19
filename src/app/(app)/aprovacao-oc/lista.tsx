"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo } from "@/components/astro/basicos";
import { TabelaDados, type ColunaTabela } from "@/components/astro/tabela-dados";
import { selectClass } from "@/components/cadastros/registro-form";
import { liberarOc } from "@/lib/ocs/actions";
import type { OcResumo } from "@/lib/ocs/dados";

// "Aprovação de OC com Pendência" do AstroTools (liberação de OCs com pendência de consistência).

type Opcao = { valor: string; rotulo: string };
const real = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AprovacaoOc({ ocs, obras, fornecedores, podeDecidir }: { ocs: OcResumo[]; obras: Opcao[]; fornecedores: Opcao[]; podeDecidir: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ obra: "", fornecedor: "", inicio: "", fim: "", perfil: "" });
  const [resultado, setResultado] = useState<OcResumo[] | null>(null);
  const [decisao, setDecisao] = useState<{ oc: OcResumo; liberar: boolean } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [pending, startTransition] = useTransition();

  const filtrar = () => {
    if (!f.perfil) return void toast.error("Selecione o Perfil.");
    setResultado(
      ocs.filter(
        (o) =>
          (!f.obra || String(o.obra_id) === f.obra) &&
          (!f.fornecedor || String(o.fornecedor_id) === f.fornecedor) &&
          (!f.inicio || o.data_emissao >= f.inicio) &&
          (!f.fim || o.data_emissao <= f.fim),
      ),
    );
  };

  const colunas: ColunaTabela<OcResumo>[] = [
    { chave: "num", titulo: "Nº OC", valor: (o) => o.numero_cliente ?? o.id, className: "font-semibold" },
    { chave: "serv", titulo: "Serviço", valor: (o) => o.nome ?? "" },
    { chave: "forn", titulo: "Fornecedor", valor: (o) => o.fornecedor_fantasia || o.fornecedor_nome },
    { chave: "saldo", titulo: "Saldo", valor: (o) => Number(o.saldo), render: (o) => real(o.saldo), className: "whitespace-nowrap" },
    { chave: "obra", titulo: "Obra", valor: (o) => o.obra_nome },
    { chave: "pend", titulo: "Pendência", valor: (o) => o.pendencia ?? "", className: "max-w-[22rem] text-[0.9rem] whitespace-normal" },
    {
      chave: "acoes",
      titulo: "Ações",
      valor: () => "",
      exportar: false,
      ordenavel: false,
      render: (o) => (
        <span className="flex items-center gap-[0.5rem] whitespace-nowrap">
          <Link href={`/ordens-compra/${o.id}`} title="Abrir OC" className="text-[#00cfe8]">
            <Search className="size-[14px]" />
          </Link>
          {podeDecidir && (
            <>
              <Button size="sm" onClick={() => setDecisao({ oc: o, liberar: true })}>
                Liberar Pedido
              </Button>
              <Button size="sm" variant="outline" className="border-[#ea5455] text-[#ea5455]" onClick={() => setDecisao({ oc: o, liberar: false })}>
                Bloquear Pedido
              </Button>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <Cartao>
      <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
        <h4 className="mb-0 text-[1.285rem] font-medium">Aprovação de OC com Pendência</h4>
      </div>
      <div className="px-[1.5rem] pt-[1.5rem]">
        <div className="grid gap-x-[2rem] md:grid-cols-2">
          <Campo rotulo="Obra" htmlFor="ap-obra">
            <select id="ap-obra" value={f.obra} onChange={(e) => setF({ ...f, obra: e.target.value })} className={selectClass}>
              <option value="">Selecione uma Obra</option>
              {obras.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Fornecedor" htmlFor="ap-forn">
            <select id="ap-forn" value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} className={selectClass}>
              <option value="">Selecione um Fornecedor</option>
              {fornecedores.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="grid gap-x-[2rem] md:grid-cols-[4fr_4fr_2fr]">
          <Campo rotulo="Data Inicial OC" htmlFor="ap-ini">
            <Input id="ap-ini" type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
          </Campo>
          <Campo rotulo="Data Final OC" htmlFor="ap-fim">
            <Input id="ap-fim" type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
          </Campo>
          <Campo rotulo="Perfil *" htmlFor="ap-perfil">
            <select id="ap-perfil" value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value })} className={selectClass}>
              <option value="">Selecione</option>
              <option value="Cordenação">Cordenação</option>
              <option value="Engenharia">Engenharia</option>
            </select>
          </Campo>
        </div>
        <div className="pb-[1.5rem]">
          <Button onClick={filtrar}>Filtrar</Button>
        </div>
      </div>
      {resultado && (
        <div className="border-t border-border">
          <TabelaDados colunas={colunas} linhas={resultado} chave={(o) => o.id} nomeArquivo="aprovacao-oc" />
        </div>
      )}

      <Dialog open={decisao !== null} onOpenChange={(o) => !o && setDecisao(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">{decisao?.liberar ? "Liberar Pedido" : "Bloquear Pedido"}</DialogTitle>
          </DialogHeader>
          {decisao && (
            <div>
              <p className="mb-[0.75rem]">
                OC {decisao.oc.numero_cliente ?? decisao.oc.id} — {decisao.oc.nome} ({decisao.oc.fornecedor_fantasia || decisao.oc.fornecedor_nome})
              </p>
              <Campo rotulo="Justificativa" htmlFor="ap-just">
                <Textarea id="ap-just" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              </Campo>
              <div className="flex gap-[0.5rem]">
                <Button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await liberarOc(decisao.oc.id, decisao.liberar, f.perfil, justificativa);
                      if (!r.ok) return void toast.error(r.erro);
                      toast.success(decisao.liberar ? "Pedido liberado." : "Pedido bloqueado.");
                      setResultado((lista) => lista?.filter((o) => o.id !== decisao.oc.id) ?? null);
                      setDecisao(null);
                      setJustificativa("");
                      router.refresh();
                    })
                  }
                >
                  Confirmar
                </Button>
                <Button variant="outline" onClick={() => setDecisao(null)}>
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}
