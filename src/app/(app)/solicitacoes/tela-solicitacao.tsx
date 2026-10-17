"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cartao, Campo } from "@/components/astro/basicos";
import { selectClass } from "@/components/cadastros/registro-form";
import { cn } from "@/lib/utils";
import { data as fmtData } from "@/lib/format";
import { STATUS_SOLICITACAO, type ItemCatalogo } from "@/lib/compras/tipos";
import { apropriarItem, efetivarSolicitacao, excluirApropriacao, importarItens, salvarSolicitacao, type ItemEnvio } from "@/lib/solicitacoes/actions";
import { BuscaItens, ModalApropriacao, cabecalho, celula, editavelCls, type Apropriacao, type CcSaldo } from "@/components/astro/itens";

export type { Apropriacao, CcSaldo };

// "Adicionar Solicitação" e "Vizualizar Solicitação" do AstroTools.

export type ItemSolicitacao = {
  id: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_medio: number | null;
  mapa_item_id: number | null;
  apropriacoes: Apropriacao[];
};
export type CabecalhoSolicitacao = {
  id: number;
  status: string;
  solicitante: string;
  obra_id: number;
  obra_rotulo: string;
  servico: string;
  observacao: string;
};
type Opcao = { valor: string; rotulo: string };

type Linha = {
  chave: string;
  id?: number;
  e_titulo: boolean;
  item_id: number | null;
  codigo: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valor_medio: number | null;
  excluir: boolean;
  noMapa: boolean;
  apropriacoes: Apropriacao[];
};

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vlMedio = (v: number | null) => (v == null ? "N/A" : `R$ ${v.toFixed(2).replace(".", ",")}`);
const numero = (s: string) => {
  const t = s.trim();
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};
let seq = 0;
const novaChave = () => `n${++seq}`;

function paraLinha(i: ItemSolicitacao): Linha {
  return {
    chave: `i${i.id}`,
    id: i.id,
    e_titulo: i.e_titulo,
    item_id: i.item_id,
    codigo: i.codigo ?? "0",
    descricao: i.descricao,
    quantidade: n2(Number(i.quantidade)),
    unidade: i.unidade,
    valor_medio: i.valor_medio,
    excluir: false,
    noMapa: i.mapa_item_id != null,
    apropriacoes: i.apropriacoes,
  };
}

export function TelaSolicitacao({
  cabecalho: cab,
  itens,
  obras,
  catalogo,
  ccs,
  outras,
  podeEditar,
}: {
  cabecalho: CabecalhoSolicitacao | null;
  itens: ItemSolicitacao[];
  obras: Opcao[];
  catalogo: ItemCatalogo[];
  ccs: CcSaldo[];
  outras: { id: number; servico: string; criado_em: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const novo = cab === null;
  const aberta = novo || cab.status === "pendente";
  const editavel = podeEditar && aberta;
  const [obra, setObra] = useState(cab ? String(cab.obra_id) : "");
  const [servico, setServico] = useState(cab?.servico ?? "");
  const [observacao, setObservacao] = useState(cab?.observacao ?? "");
  const [linhas, setLinhas] = useState<Linha[]>(() => itens.map(paraLinha));
  const [ativa, setAtiva] = useState<string | null>(null);
  const [aprop, setAprop] = useState<Linha | null>(null);
  const [importar, setImportar] = useState(false);
  const [escolha, setEscolha] = useState(false);
  const [selecao, setSelecao] = useState<number[] | null>(null);
  const [pending, startTransition] = useTransition();

  const inserir = (l: Linha) =>
    setLinhas((ls) => {
      const i = ativa ? ls.findIndex((x) => x.chave === ativa) : -1;
      return i < 0 ? [...ls, l] : [...ls.slice(0, i + 1), l, ...ls.slice(i + 1)];
    });
  const mudar = (chave: string, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));

  const itensValidos = linhas.filter((l) => !l.excluir && !l.e_titulo);
  const tudoApropriado = itensValidos.length > 0 && itensValidos.every((l) => l.id && l.apropriacoes.length > 0);
  const pendentesMapa = linhas.filter((l) => l.id && !l.e_titulo && !l.noMapa);

  const salvar = () => {
    const envio: ItemEnvio[] = [];
    for (const l of linhas) {
      if (!l.descricao.trim() && !l.id) continue;
      const q = numero(l.quantidade || "0");
      if (Number.isNaN(q)) return void toast.error(`Quantidade inválida em "${l.descricao}".`);
      envio.push({
        id: l.id,
        e_titulo: l.e_titulo,
        item_id: l.item_id,
        codigo: l.codigo,
        descricao: l.descricao.trim(),
        quantidade: q,
        unidade: l.unidade.trim(),
        valor_medio: l.valor_medio,
        excluir: l.excluir,
      });
    }
    startTransition(async () => {
      const r = await salvarSolicitacao(cab?.id ?? null, { obra_id: obra, servico, observacao }, envio);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Solicitação salva com sucesso.");
      if (novo) router.push(`/solicitacoes/${r.id}`);
      else router.refresh();
    });
  };

  const efetivar = (ids: number[] | null) =>
    startTransition(async () => {
      const r = await efetivarSolicitacao(cab!.id, ids);
      if (!r.ok) return void toast.error(r.erro);
      setEscolha(false);
      setSelecao(null);
      toast.success("Solicitação efetivada. Mapa de cotação criado.");
      router.refresh();
    });

  const status = cab ? STATUS_SOLICITACAO[cab.status] : null;

  return (
    <Cartao>
      {novo ? (
        <div className="border-b border-border px-[1.5rem] py-[1.5rem]">
          <h4 className="mb-0 text-[1.285rem] font-medium">Nova Solicitação</h4>
        </div>
      ) : (
        <div className="grid grid-cols-3 items-center border-b border-border px-[1.5rem] py-[1.5rem]">
          <h4 className="mb-0 text-[1.285rem] font-medium">Solicitação: {cab.id}</h4>
          <span className={cn("text-center text-[1rem] font-semibold", cab.status === "atendida" ? "text-primary" : "text-[#ff9f43]")}>{status?.rotulo}</span>
          <h4 className="mb-0 text-right text-[1.285rem] font-medium">Solicitante: {cab.solicitante}</h4>
        </div>
      )}

      <div className="px-[1.5rem] pt-[1.5rem]">
        <div className="grid gap-x-[2rem] md:grid-cols-2">
          <Campo rotulo="Obra" htmlFor="s-obra">
            {novo ? (
              <select id="s-obra" value={obra} onChange={(e) => setObra(e.target.value)} className={selectClass}>
                <option value="">Selecione uma Obra</option>
                {obras.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <Input id="s-obra" value={cab.obra_rotulo} disabled />
            )}
          </Campo>
          <Campo rotulo="Serviço" htmlFor="s-servico">
            <Input id="s-servico" value={servico} onChange={(e) => setServico(e.target.value)} disabled={!editavel} />
          </Campo>
        </div>
        <Campo rotulo="Observação" htmlFor="s-obs">
          <Textarea id="s-obs" rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={!editavel} />
        </Campo>
      </div>

      <div className="flex items-center justify-between border-t border-border px-[1.5rem] py-[0.2rem]">
        <div>
          {!novo && (tudoApropriado || !aberta) && (
            <Button disabled={!editavel || pending || pendentesMapa.length === 0} onClick={() => setEscolha(true)} className="disabled:opacity-65">
              Efetivar Solicitação
            </Button>
          )}
        </div>
        <div className="flex gap-[0.5rem]">
          <Button onClick={salvar} disabled={!editavel || pending} className="disabled:opacity-65">
            Salvar
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            {novo ? "cancelar" : "Voltar"}
          </Button>
        </div>
      </div>

      <div className="px-[1.5rem] pt-[1.5rem] pb-[2.5rem]">
        {editavel && (
          <div className="mb-[1rem] space-y-[1rem]">
            <BuscaItens
              catalogo={catalogo}
              onAdicionar={(c) =>
                inserir({
                  chave: novaChave(),
                  e_titulo: false,
                  item_id: c.id,
                  codigo: c.codigo,
                  descricao: c.descricao,
                  quantidade: "0",
                  unidade: c.unidade,
                  valor_medio: c.valor_medio,
                  excluir: false,
                  noMapa: false,
                  apropriacoes: [],
                })
              }
            />
            <div className="flex gap-[0.5rem]">
              <Button
                variant="outline"
                onClick={() =>
                  inserir({
                    chave: novaChave(),
                    e_titulo: false,
                    item_id: null,
                    codigo: "0",
                    descricao: "",
                    quantidade: "0",
                    unidade: "",
                    valor_medio: null,
                    excluir: false,
                    noMapa: false,
                    apropriacoes: [],
                  })
                }
              >
                Adicionar Linha
              </Button>
              {!novo && outras.length > 0 && (
                <Button variant="outline" onClick={() => setImportar(true)}>
                  Importar Itens
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[1rem]">
            <thead>
              <tr>
                <th className={cn(cabecalho, "w-[5%]")}>{novo ? "Tit" : "Tit."}</th>
                <th className={cn(cabecalho, "w-[6%]")}>Cod.</th>
                <th className={cabecalho}>Item</th>
                <th className={cn(cabecalho, "w-[9%]")}>Qtde</th>
                <th className={cn(cabecalho, "w-[8%]")}>{novo ? "Unid." : "Unid.Med"}</th>
                <th className={cn(cabecalho, "w-[9%]")}>Vl.Médio</th>
                <th className={cn(cabecalho, "w-[8%]")}>{novo ? "Del." : "Ações"}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const livre = l.item_id == null;
                const pode = editavel && !l.noMapa && !l.excluir;
                return (
                  <tr
                    key={l.chave}
                    onClick={() => setAtiva(l.chave)}
                    className={cn(ativa === l.chave && "bg-[#f3f2f7] dark:bg-[#242b3d]", l.excluir && "opacity-50", l.e_titulo && "font-semibold")}
                  >
                    <td className={cn(celula, "text-center")}>
                      <input
                        type="checkbox"
                        checked={l.e_titulo}
                        disabled={!pode || !livre}
                        onChange={(e) => mudar(l.chave, { e_titulo: e.target.checked })}
                        className="size-[14px] accent-primary"
                        aria-label="Título"
                      />
                    </td>
                    <td className={celula}>{l.codigo}</td>
                    <td className={celula}>
                      {pode && livre ? <input value={l.descricao} onChange={(e) => mudar(l.chave, { descricao: e.target.value })} className={editavelCls} aria-label="Item" /> : l.descricao}
                    </td>
                    <td className={celula}>
                      {pode ? <input value={l.quantidade} onChange={(e) => mudar(l.chave, { quantidade: e.target.value })} className={editavelCls} aria-label="Quantidade" /> : l.quantidade}
                    </td>
                    <td className={celula}>
                      {pode && livre ? <input value={l.unidade} onChange={(e) => mudar(l.chave, { unidade: e.target.value })} className={editavelCls} aria-label="Unidade" /> : l.unidade}
                    </td>
                    <td className={celula}>{vlMedio(l.valor_medio)}</td>
                    <td className={celula}>
                      <div className="flex flex-col items-start gap-[0.5rem]">
                        {editavel && !l.noMapa && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!l.id) setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
                              else mudar(l.chave, { excluir: !l.excluir });
                            }}
                            className={cn("rounded-[0.358rem] px-[0.9rem] py-[0.3rem] text-[0.857rem] text-white", l.excluir ? "bg-[#28c76f]" : "bg-[#ea5455]")}
                          >
                            {l.excluir ? "Adicionar" : "Excluir"}
                          </button>
                        )}
                        {!novo && !l.e_titulo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!l.id) return void toast.info("Salve a solicitação antes de apropriar este item.");
                              setAprop(l);
                            }}
                            className={cn("px-[0.4rem] text-[1rem] text-[#ff9f43]", l.apropriacoes.length > 0 && "border border-[#ff9f43] bg-[#ffff00] text-[#ff9f43]")}
                          >
                            Aprop.
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {linhas.length === 0 && !novo && (
                <tr>
                  <td colSpan={7} className={cn(celula, "text-center")}>
                    Nenhum item
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apropriações */}
      <Dialog open={aprop !== null} onOpenChange={(o) => !o && setAprop(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">Apropriações</DialogTitle>
          </DialogHeader>
          {aprop && cab && (
            <ModalApropriacao
              key={aprop.chave}
              linha={{ ...(linhas.find((l) => l.chave === aprop.chave) ?? aprop), bloqueado: aprop.noMapa }}
              onApropriar={(itemId, ccId) => apropriarItem(cab.id, itemId, ccId)}
              onExcluir={(id) => excluirApropriacao(cab.id, id)}
              ccs={ccs}
              podeEditar={editavel}
              onFechar={() => setAprop(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Importar itens de outra solicitação da obra */}
      <Dialog open={importar} onOpenChange={setImportar}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">Importar Itens</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-[1rem]">
              <thead>
                <tr>
                  <th className={cabecalho}>Cod.</th>
                  <th className={cabecalho}>Serviço</th>
                  <th className={cabecalho}>Data</th>
                  <th className={cabecalho}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {outras.map((o) => (
                  <tr key={o.id}>
                    <td className={celula}>{o.id}</td>
                    <td className={celula}>{o.servico}</td>
                    <td className={celula}>{fmtData(o.criado_em)}</td>
                    <td className={celula}>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Confirma A importação dos itens? Solicitação:${o.id}`)) return;
                          startTransition(async () => {
                            const r = await importarItens(cab!.id, o.id);
                            if (!r.ok) return void toast.error(r.erro);
                            toast.success("Itens importados.");
                            setImportar(false);
                            router.refresh();
                          });
                        }}
                      >
                        Imp.
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Efetivar: Todos Itens / Selecionar Itens */}
      <Dialog open={escolha} onOpenChange={setEscolha}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-[1rem] py-[1rem] text-center">
            <span className="flex size-[80px] items-center justify-center rounded-full border-4 border-[#facea8] text-[3rem] text-[#f8bb86]">!</span>
            <p className="text-[1.1rem]">Escolha uma das opções para continuar com a Solicitação para Cotação:</p>
            <div className="flex flex-wrap justify-center gap-[0.5rem]">
              <Button disabled={pending} onClick={() => efetivar(null)}>
                Todos Itens
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setEscolha(false);
                  setSelecao([]);
                }}
              >
                Selecionar Itens
              </Button>
              <Button variant="outline" className="border-[#ea5455] text-[#ea5455]" onClick={() => setEscolha(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selecao !== null} onOpenChange={(o) => !o && setSelecao(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[1.285rem] font-medium text-heading">Selecionar Itens para o Mapa:</DialogTitle>
          </DialogHeader>
          <table className="w-full text-[1rem]">
            <thead>
              <tr>
                <th className={cabecalho}>Selecionar</th>
                <th className={cabecalho}>COD.</th>
                <th className={cabecalho}>Nome</th>
                <th className={cabecalho}>QTDE</th>
              </tr>
            </thead>
            <tbody>
              {linhas
                .filter((l) => l.id && !l.e_titulo)
                .map((l) => (
                  <tr key={l.chave}>
                    <td className={celula}>
                      <input
                        type="checkbox"
                        disabled={l.noMapa}
                        checked={l.noMapa || (selecao ?? []).includes(l.id!)}
                        onChange={(e) => setSelecao((s) => (e.target.checked ? [...(s ?? []), l.id!] : (s ?? []).filter((x) => x !== l.id)))}
                        className="size-[16px] accent-primary"
                      />
                    </td>
                    <td className={celula}>{l.codigo}</td>
                    <td className={celula}>{l.descricao}</td>
                    <td className={celula}>{l.quantidade}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="flex gap-[0.5rem]">
            <Button disabled={pending || !selecao?.length} onClick={() => efetivar(selecao)}>
              Adicionar Selecionados
            </Button>
            <Button variant="outline" onClick={() => setSelecao(null)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}
